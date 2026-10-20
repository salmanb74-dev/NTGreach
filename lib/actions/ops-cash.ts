'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getCachedProfile } from '@/lib/dataCache'
import {
  cashDefaultsFromSubscription,
  collectionStatusFromAmounts,
  computeCashDueStatusFromRows,
  generateExpectedDueSpecs,
  isUnpaidStatus,
  normalizeCashNote,
  todayISO,
  type CashCollectionKind,
  type CashCollectionStatus,
  type CashDueStatus,
  type CashProduct,
  type OpsCashCollection,
  type OpsCashTenant,
} from '@/lib/ops/cash-collection'
import {
  hasOpsProductAccess,
  isOpsProductAdmin,
  type UserProfile,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

function nestProductFromCash(product: CashProduct): 'resto' | 'alma' {
  return product === 'alma' ? 'alma' : 'resto'
}

/** Read + cash collect for Ops Admin or Ops User on the product. */
async function requireOpsCashAccess(
  product: CashProduct = 'resto'
): Promise<UserProfile> {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, nestProductFromCash(product))) {
    throw new Error('Forbidden')
  }
  return profile!
}

/** Cash settings / row delete / expected edits — Ops Admin only. */
async function requireOpsCashAdmin(
  product: CashProduct = 'resto'
): Promise<UserProfile> {
  const profile = await getCachedProfile()
  if (!isOpsProductAdmin(profile, nestProductFromCash(product))) {
    throw new Error('Forbidden — Ops Admin required')
  }
  return profile!
}

function revalidateCash(tenantId?: string) {
  revalidatePath('/ops/management')
  revalidatePath('/ops/tenants')
  if (tenantId) {
    revalidatePath(`/ops/management/${tenantId}`)
    revalidatePath(`/ops/tenants/${tenantId}`)
  }
}

function mapTenant(row: Record<string, unknown>): OpsCashTenant {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    product: (row.product as CashProduct) || 'resto',
    enabled: row.enabled === true,
    currency: String(row.currency ?? 'USD'),
    schedule_anchor: row.schedule_anchor
      ? String(row.schedule_anchor).slice(0, 10)
      : null,
    cycle_months: Number(row.cycle_months) || 1,
    default_setup_amount:
      row.default_setup_amount == null ? null : Number(row.default_setup_amount),
    default_pre_trial_setup_amount:
      row.default_pre_trial_setup_amount == null
        ? null
        : Number(row.default_pre_trial_setup_amount),
    default_recurring_amount:
      row.default_recurring_amount == null
        ? null
        : Number(row.default_recurring_amount),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapCollection(row: Record<string, unknown>): OpsCashCollection {
  const expected =
    row.expected_amount == null ? Number(row.amount ?? 0) : Number(row.expected_amount)
  const collected =
    row.amount_collected == null
      ? Number(row.amount ?? 0)
      : Number(row.amount_collected)
  const statusRaw = row.status as CashCollectionStatus | undefined
  const status =
    statusRaw === 'due' || statusRaw === 'partial' || statusRaw === 'collected'
      ? statusRaw
      : collectionStatusFromAmounts(expected, collected)

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    product: (row.product as CashProduct) || 'resto',
    kind: row.kind as CashCollectionKind,
    expected_amount: expected,
    amount_collected: collected,
    currency: String(row.currency ?? 'USD'),
    due_date: String(row.due_date).slice(0, 10),
    collected_on: row.collected_on
      ? String(row.collected_on).slice(0, 10)
      : null,
    status,
    notes: row.notes == null ? null : String(row.notes),
    collected_by: row.collected_by == null ? null : String(row.collected_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

async function loadCollections(
  supabase: SupabaseClient,
  tenantId: string,
  product: CashProduct
): Promise<OpsCashCollection[]> {
  const { data, error } = await supabase
    .from('ops_cash_collections')
    .select('*')
    .eq('product', product)
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true })
    .order('kind', { ascending: true })

  assertNoError(error, 'Failed to load collections')
  return (data ?? []).map(r => mapCollection(r as Record<string, unknown>))
}

/**
 * Ensure expected due rows exist for all past + one future cycle.
 * Past / fully collected rows are kept. Unpaid future rows are replaced
 * from current schedule defaults.
 */
async function syncExpectedCollectionRows(
  supabase: SupabaseClient,
  settings: OpsCashTenant
): Promise<void> {
  if (!settings.enabled) return
  const today = todayISO()
  const specs = generateExpectedDueSpecs({
    scheduleAnchor: settings.schedule_anchor,
    cycleMonths: settings.cycle_months,
    recurringAmount: settings.default_recurring_amount,
    setupAmount: settings.default_setup_amount,
    preTrialSetupAmount: settings.default_pre_trial_setup_amount,
    today,
  })

  const existing = await loadCollections(
    supabase,
    settings.tenant_id,
    settings.product
  )

  const keepIds = new Set<string>()
  const byKey = new Map<string, OpsCashCollection>()
  for (const row of existing) {
    byKey.set(`${row.kind}|${row.due_date}`, row)
  }

  // Drop unpaid future rows (due / partial) so they can be rebuilt
  const toDelete: string[] = []
  for (const row of existing) {
    const isFuture = row.due_date > today
    if (isFuture && isUnpaidStatus(row.status)) {
      toDelete.push(row.id)
      byKey.delete(`${row.kind}|${row.due_date}`)
    } else {
      keepIds.add(row.id)
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('ops_cash_collections')
      .delete()
      .in('id', toDelete)
      .eq('product', settings.product)
      .eq('tenant_id', settings.tenant_id)
    assertNoError(error, 'Failed to clear unpaid future dues')
  }

  const inserts: Record<string, unknown>[] = []
  for (const spec of specs) {
    const key = `${spec.kind}|${spec.dueDate}`
    const prev = byKey.get(key)
    if (prev) {
      // Past / collected rows stay as-is (including historical expected amounts)
      keepIds.add(prev.id)
      continue
    }
    inserts.push({
      tenant_id: settings.tenant_id,
      product: settings.product,
      kind: spec.kind,
      expected_amount: spec.expectedAmount,
      amount_collected: 0,
      currency: settings.currency || 'USD',
      due_date: spec.dueDate,
      collected_on: null,
      status: 'due',
      notes: null,
      collected_by: null,
    })
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('ops_cash_collections').insert(inserts)
    assertNoError(error, 'Failed to create expected collection rows')
  }
}

export type CashTenantSummary = {
  tenantId: string
  settings: OpsCashTenant
  due: CashDueStatus
}

/** List cash settings + next-due for all enabled tenants (production UI). */
export async function listCashTenantSummaries(
  product: CashProduct = 'resto'
): Promise<CashTenantSummary[]> {
  await requireOpsCashAccess(product)
  const supabase = await createClient()

  const { data: settingsRows, error: sErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', product)
    .eq('enabled', true)

  assertNoError(sErr, 'Failed to load cash tenants')
  const settings = (settingsRows ?? []).map(r => mapTenant(r as Record<string, unknown>))
  if (settings.length === 0) return []

  // Keep expected dues current (past + one future) for list “Cash due”
  for (const s of settings) {
    await syncExpectedCollectionRows(supabase, s)
  }

  const tenantIds = settings.map(s => s.tenant_id)
  const { data: colRows, error: cErr } = await supabase
    .from('ops_cash_collections')
    .select(
      'id, tenant_id, kind, due_date, status, expected_amount, amount_collected'
    )
    .eq('product', product)
    .in('tenant_id', tenantIds)

  assertNoError(cErr, 'Failed to load cash collections')

  const byTenant = new Map<string, OpsCashCollection[]>()
  for (const id of tenantIds) byTenant.set(id, [])
  for (const raw of colRows ?? []) {
    const row = mapCollection(raw as Record<string, unknown>)
    byTenant.get(row.tenant_id)?.push(row)
  }

  return settings.map(s => ({
    tenantId: s.tenant_id,
    settings: s,
    due: computeCashDueStatusFromRows(byTenant.get(s.tenant_id) ?? []),
  }))
}

export async function getCashTenant(
  tenantId: string,
  product: CashProduct = 'resto'
): Promise<{
  settings: OpsCashTenant | null
  collections: OpsCashCollection[]
  due: CashDueStatus
}> {
  await requireOpsCashAccess(product)
  const supabase = await createClient()

  const { data: settingsRow, error: sErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', product)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  assertNoError(sErr, 'Failed to load cash settings')

  const settings = settingsRow
    ? mapTenant(settingsRow as Record<string, unknown>)
    : null

  // Keep schedule rows fresh when viewing an enabled tenant
  if (settings?.enabled) {
    await syncExpectedCollectionRows(supabase, settings)
  }

  const collections = await loadCollections(supabase, tenantId, product)
  const due = computeCashDueStatusFromRows(collections)

  return { settings, collections, due }
}

export type UpsertCashSettingsInput = {
  tenantId: string
  product?: CashProduct
  enabled: boolean
  currency?: string
  scheduleAnchor?: string | null
  cycleMonths?: number
  defaultSetupAmount?: number | null
  defaultPreTrialSetupAmount?: number | null
  defaultRecurringAmount?: number | null
  notes?: string | null
  /** Loose Nest subscription snapshot — used to seed blanks when enabling. */
  subscription?: Record<string, unknown> | null
  /** When true, overwrite schedule fields from subscription enterprise terms. */
  syncFromSubscription?: boolean
}

export async function upsertCashSettings(
  input: UpsertCashSettingsInput
): Promise<OpsCashTenant> {
  const product = input.product ?? 'resto'
  await requireOpsCashAdmin(product)
  const supabase = await createClient()
  const defaults = cashDefaultsFromSubscription(input.subscription)

  const { data: existing, error: exErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  assertNoError(exErr)

  const prev = existing as Record<string, unknown> | null
  const sync = input.syncFromSubscription === true

  if (sync && input.subscription && !defaults.isEnterprise) {
    throw new Error(
      'Cash sync is enterprise-only — no enterprise price, duration, or setup fees found.'
    )
  }

  const scheduleAnchor = sync
    ? defaults.scheduleAnchor
    : input.scheduleAnchor !== undefined
      ? input.scheduleAnchor
      : prev?.schedule_anchor
        ? String(prev.schedule_anchor).slice(0, 10)
        : defaults.scheduleAnchor

  const cycleMonths = sync
    ? defaults.cycleMonths
    : input.cycleMonths !== undefined
      ? Math.max(1, Math.floor(input.cycleMonths))
      : prev?.cycle_months
        ? Number(prev.cycle_months)
        : defaults.cycleMonths

  const currency =
    input.currency ??
    (prev?.currency ? String(prev.currency) : defaults.currency)

  const defaultSetupAmount = sync
    ? defaults.defaultSetupAmount
    : input.defaultSetupAmount !== undefined
      ? input.defaultSetupAmount
      : prev?.default_setup_amount != null
        ? Number(prev.default_setup_amount)
        : defaults.defaultSetupAmount

  const defaultPreTrialSetupAmount = sync
    ? defaults.defaultPreTrialSetupAmount
    : input.defaultPreTrialSetupAmount !== undefined
      ? input.defaultPreTrialSetupAmount
      : prev?.default_pre_trial_setup_amount != null
        ? Number(prev.default_pre_trial_setup_amount)
        : defaults.defaultPreTrialSetupAmount

  const defaultRecurringAmount = sync
    ? defaults.defaultRecurringAmount
    : input.defaultRecurringAmount !== undefined
      ? input.defaultRecurringAmount
      : prev?.default_recurring_amount != null
        ? Number(prev.default_recurring_amount)
        : defaults.defaultRecurringAmount

  const payload = {
    tenant_id: input.tenantId,
    product,
    enabled: input.enabled,
    currency,
    schedule_anchor: scheduleAnchor,
    cycle_months: cycleMonths,
    default_setup_amount: defaultSetupAmount,
    default_pre_trial_setup_amount: defaultPreTrialSetupAmount,
    default_recurring_amount: defaultRecurringAmount,
    notes:
      input.notes !== undefined
        ? input.notes
        : prev?.notes == null
          ? null
          : String(prev.notes),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('ops_cash_tenants')
    .upsert(payload, { onConflict: 'product,tenant_id' })
    .select('*')
    .single()

  assertNoError(error, 'Failed to save cash settings')
  assertRows(data ? [data] : null)

  const settings = mapTenant(data as Record<string, unknown>)
  if (settings.enabled) {
    await syncExpectedCollectionRows(supabase, settings)
  }

  revalidateCash(input.tenantId)
  return settings
}

/** Refresh schedule defaults from a Nest subscription and regenerate unpaid future rows. */
export async function syncCashDefaultsFromSubscription(
  tenantId: string,
  subscription: Record<string, unknown> | null,
  product: CashProduct = 'resto'
): Promise<OpsCashTenant> {
  await requireOpsCashAdmin(product)
  return upsertCashSettings({
    tenantId,
    product,
    enabled: true,
    subscription,
    syncFromSubscription: true,
  })
}

export type RecordCashPaymentInput = {
  id: string
  tenantId: string
  product?: CashProduct
  amountCollected: number
  collectedOn?: string | null
  notes?: string | null
}

/** Record or edit payment on an expected due row (partial if under expected). */
export async function recordCashPayment(
  input: RecordCashPaymentInput
): Promise<OpsCashCollection> {
  const product = input.product ?? 'resto'
  const profile = await requireOpsCashAccess(product)
  const supabase = await createClient()

  if (!(input.amountCollected >= 0) || !Number.isFinite(input.amountCollected)) {
    throw new Error('Amount must be a non-negative number')
  }

  const { data: existing, error: exErr } = await supabase
    .from('ops_cash_collections')
    .select('*')
    .eq('id', input.id)
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  assertNoError(exErr, 'Failed to load collection row')
  if (!existing) throw new Error('Collection row not found')

  const row = mapCollection(existing as Record<string, unknown>)
  const amountCollected = input.amountCollected
  const status = collectionStatusFromAmounts(row.expected_amount, amountCollected)
  const collectedOn =
    amountCollected > 0
      ? (input.collectedOn ?? row.collected_on ?? todayISO()).slice(0, 10)
      : null

  const { data, error } = await supabase
    .from('ops_cash_collections')
    .update({
      amount_collected: amountCollected,
      collected_on: collectedOn,
      status,
      notes:
        input.notes !== undefined
          ? normalizeCashNote(input.notes)
          : row.notes,
      collected_by: amountCollected > 0 ? profile.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .select('*')
    .single()

  assertNoError(error, 'Failed to record collection')
  assertRows(data ? [data] : null)
  revalidateCash(input.tenantId)
  return mapCollection(data as Record<string, unknown>)
}

export type UpdateCashCollectionInput = {
  id: string
  tenantId: string
  product?: CashProduct
  kind?: CashCollectionKind
  expectedAmount?: number
  amountCollected?: number
  currency?: string
  dueDate?: string
  collectedOn?: string | null
  notes?: string | null
}

export async function updateCashCollection(
  input: UpdateCashCollectionInput
): Promise<OpsCashCollection> {
  const product = input.product ?? 'resto'
  const profile = await requireOpsCashAdmin(product)
  const supabase = await createClient()

  const { data: existing, error: exErr } = await supabase
    .from('ops_cash_collections')
    .select('*')
    .eq('id', input.id)
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  assertNoError(exErr)
  if (!existing) throw new Error('Collection row not found')
  const prev = mapCollection(existing as Record<string, unknown>)

  const expectedAmount =
    input.expectedAmount !== undefined
      ? input.expectedAmount
      : prev.expected_amount
  const amountCollected =
    input.amountCollected !== undefined
      ? input.amountCollected
      : prev.amount_collected

  if (!(expectedAmount >= 0) || !Number.isFinite(expectedAmount)) {
    throw new Error('Expected amount must be a non-negative number')
  }
  if (!(amountCollected >= 0) || !Number.isFinite(amountCollected)) {
    throw new Error('Collected amount must be a non-negative number')
  }

  const status = collectionStatusFromAmounts(expectedAmount, amountCollected)
  let collectedOn: string | null =
    input.collectedOn !== undefined
      ? input.collectedOn
        ? input.collectedOn.slice(0, 10)
        : null
      : prev.collected_on
  if (amountCollected > 0 && !collectedOn) collectedOn = todayISO()
  if (amountCollected <= 0) collectedOn = null

  const patch: Record<string, unknown> = {
    expected_amount: expectedAmount,
    amount_collected: amountCollected,
    status,
    collected_on: collectedOn,
    updated_at: new Date().toISOString(),
  }
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.currency !== undefined) patch.currency = input.currency
  if (input.dueDate !== undefined) patch.due_date = input.dueDate.slice(0, 10)
  if (input.notes !== undefined) patch.notes = normalizeCashNote(input.notes)
  if (amountCollected > 0) patch.collected_by = profile.id
  if (amountCollected <= 0) patch.collected_by = null

  const { data, error } = await supabase
    .from('ops_cash_collections')
    .update(patch)
    .eq('id', input.id)
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .select('*')
    .single()

  assertNoError(error, 'Failed to update collection')
  assertRows(data ? [data] : null)
  revalidateCash(input.tenantId)
  return mapCollection(data as Record<string, unknown>)
}

/** @deprecated Prefer recordCashPayment against an expected due row. */
export type CreateCashCollectionInput = {
  tenantId: string
  product?: CashProduct
  kind: CashCollectionKind
  amount: number
  currency: string
  dueDate: string
  collectedOn?: string
  notes?: string | null
  expectedAmount?: number
}

export async function createCashCollection(
  input: CreateCashCollectionInput
): Promise<OpsCashCollection> {
  const product = input.product ?? 'resto'
  const profile = await requireOpsCashAdmin(product)
  const supabase = await createClient()

  if (!(input.amount >= 0) || !Number.isFinite(input.amount)) {
    throw new Error('Amount must be a non-negative number')
  }
  if (
    !['setup', 'setup_pre_trial', 'recurring', 'other'].includes(input.kind)
  ) {
    throw new Error('Invalid collection type')
  }

  const expectedAmount =
    input.expectedAmount != null && Number.isFinite(input.expectedAmount)
      ? input.expectedAmount
      : input.amount
  const status = collectionStatusFromAmounts(expectedAmount, input.amount)

  // If an expected row already exists for this due, update it instead
  const { data: existing } = await supabase
    .from('ops_cash_collections')
    .select('*')
    .eq('product', product)
    .eq('tenant_id', input.tenantId)
    .eq('kind', input.kind)
    .eq('due_date', input.dueDate.slice(0, 10))
    .maybeSingle()

  if (existing) {
    return recordCashPayment({
      id: String((existing as { id: string }).id),
      tenantId: input.tenantId,
      product,
      amountCollected: input.amount,
      collectedOn: input.collectedOn,
      notes: input.notes,
    })
  }

  const { data, error } = await supabase
    .from('ops_cash_collections')
    .insert({
      tenant_id: input.tenantId,
      product,
      kind: input.kind,
      expected_amount: expectedAmount,
      amount_collected: input.amount,
      currency: input.currency || 'USD',
      due_date: input.dueDate.slice(0, 10),
      collected_on:
        input.amount > 0
          ? (input.collectedOn ?? todayISO()).slice(0, 10)
          : null,
      status,
      notes: normalizeCashNote(input.notes),
      collected_by: input.amount > 0 ? profile.id : null,
    })
    .select('*')
    .single()

  assertNoError(error, 'Failed to record collection')
  assertRows(data ? [data] : null)
  revalidateCash(input.tenantId)
  return mapCollection(data as Record<string, unknown>)
}

export async function deleteCashCollection(
  id: string,
  tenantId: string,
  product: CashProduct = 'resto'
): Promise<void> {
  await requireOpsCashAdmin(product)
  const supabase = await createClient()

  const { error } = await supabase
    .from('ops_cash_collections')
    .delete()
    .eq('id', id)
    .eq('product', product)
    .eq('tenant_id', tenantId)

  assertNoError(error, 'Failed to delete collection')
  revalidateCash(tenantId)
}

/** Mark the next unpaid due as fully collected (list quick-action). */
export async function collectNextCashDue(
  tenantId: string,
  product: CashProduct = 'resto'
): Promise<OpsCashCollection> {
  await requireOpsCashAccess(product)
  const { due, collections } = await getCashTenant(tenantId, product)
  if (!due.nextRowId) {
    throw new Error('No unpaid cash due for this tenant')
  }
  const row = collections.find(c => c.id === due.nextRowId)
  if (!row) throw new Error('Next due row not found')
  return recordCashPayment({
    id: row.id,
    tenantId,
    product,
    amountCollected: row.expected_amount,
    collectedOn: todayISO(),
  })
}
