'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getCachedProfile } from '@/lib/dataCache'
import {
  cashDefaultsFromSubscription,
  computeCashDueStatus,
  todayISO,
  type CashCollectionKind,
  type CashDueStatus,
  type CashProduct,
  type OpsCashCollection,
  type OpsCashTenant,
} from '@/lib/ops/cash-collection'
import { isPlatformOpsAdmin } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PRODUCT: CashProduct = 'resto'

async function requireOpsAdmin() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) {
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
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    product: (row.product as CashProduct) || 'resto',
    kind: row.kind as CashCollectionKind,
    amount: Number(row.amount),
    currency: String(row.currency ?? 'USD'),
    due_date: String(row.due_date).slice(0, 10),
    collected_on: String(row.collected_on).slice(0, 10),
    notes: row.notes == null ? null : String(row.notes),
    collected_by: row.collected_by == null ? null : String(row.collected_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export type CashTenantSummary = {
  tenantId: string
  settings: OpsCashTenant
  due: CashDueStatus
}

/** List cash settings + next-due for all enabled resto tenants (production UI). */
export async function listCashTenantSummaries(): Promise<CashTenantSummary[]> {
  await requireOpsAdmin()
  const supabase = await createClient()

  const { data: settingsRows, error: sErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', PRODUCT)
    .eq('enabled', true)

  assertNoError(sErr, 'Failed to load cash tenants')
  const settings = (settingsRows ?? []).map(r => mapTenant(r as Record<string, unknown>))
  if (settings.length === 0) return []

  const tenantIds = settings.map(s => s.tenant_id)
  const { data: colRows, error: cErr } = await supabase
    .from('ops_cash_collections')
    .select('tenant_id, kind, due_date')
    .eq('product', PRODUCT)
    .in('tenant_id', tenantIds)

  assertNoError(cErr, 'Failed to load cash collections')

  const byTenant = new Map<
    string,
    { setup: boolean; recurringDates: string[] }
  >()
  for (const id of tenantIds) {
    byTenant.set(id, { setup: false, recurringDates: [] })
  }
  for (const raw of colRows ?? []) {
    const row = raw as { tenant_id: string; kind: string; due_date: string }
    const bucket = byTenant.get(row.tenant_id)
    if (!bucket) continue
    if (row.kind === 'setup') bucket.setup = true
    if (row.kind === 'recurring') {
      bucket.recurringDates.push(String(row.due_date).slice(0, 10))
    }
  }

  return settings.map(s => {
    const bucket = byTenant.get(s.tenant_id) ?? {
      setup: false,
      recurringDates: [],
    }
    return {
      tenantId: s.tenant_id,
      settings: s,
      due: computeCashDueStatus({
        scheduleAnchor: s.schedule_anchor,
        cycleMonths: s.cycle_months,
        setupCollected: bucket.setup,
        recurringPaidDueDates: bucket.recurringDates,
      }),
    }
  })
}

export async function getCashTenant(
  tenantId: string
): Promise<{
  settings: OpsCashTenant | null
  collections: OpsCashCollection[]
  due: CashDueStatus
}> {
  await requireOpsAdmin()
  const supabase = await createClient()

  const { data: settingsRow, error: sErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', PRODUCT)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  assertNoError(sErr, 'Failed to load cash settings')

  const { data: colRows, error: cErr } = await supabase
    .from('ops_cash_collections')
    .select('*')
    .eq('product', PRODUCT)
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false })
    .order('collected_on', { ascending: false })

  assertNoError(cErr, 'Failed to load collections')

  const collections = (colRows ?? []).map(r =>
    mapCollection(r as Record<string, unknown>)
  )
  const settings = settingsRow
    ? mapTenant(settingsRow as Record<string, unknown>)
    : null

  const due = computeCashDueStatus({
    scheduleAnchor: settings?.schedule_anchor ?? null,
    cycleMonths: settings?.cycle_months ?? 1,
    setupCollected: collections.some(c => c.kind === 'setup'),
    recurringPaidDueDates: collections
      .filter(c => c.kind === 'recurring')
      .map(c => c.due_date),
  })

  return { settings, collections, due }
}

export type UpsertCashSettingsInput = {
  tenantId: string
  enabled: boolean
  currency?: string
  scheduleAnchor?: string | null
  cycleMonths?: number
  defaultSetupAmount?: number | null
  defaultRecurringAmount?: number | null
  notes?: string | null
  /** Loose Nest subscription snapshot — used to seed blanks when enabling. */
  subscription?: Record<string, unknown> | null
}

export async function upsertCashSettings(
  input: UpsertCashSettingsInput
): Promise<OpsCashTenant> {
  const profile = await requireOpsAdmin()
  const supabase = await createClient()
  const defaults = cashDefaultsFromSubscription(input.subscription)

  const { data: existing, error: exErr } = await supabase
    .from('ops_cash_tenants')
    .select('*')
    .eq('product', PRODUCT)
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  assertNoError(exErr)

  const prev = existing as Record<string, unknown> | null

  const scheduleAnchor =
    input.scheduleAnchor !== undefined
      ? input.scheduleAnchor
      : prev?.schedule_anchor
        ? String(prev.schedule_anchor).slice(0, 10)
        : defaults.scheduleAnchor

  const cycleMonths =
    input.cycleMonths !== undefined
      ? Math.max(1, Math.floor(input.cycleMonths))
      : prev?.cycle_months
        ? Number(prev.cycle_months)
        : defaults.cycleMonths

  const currency =
    input.currency ??
    (prev?.currency ? String(prev.currency) : defaults.currency)

  const defaultSetupAmount =
    input.defaultSetupAmount !== undefined
      ? input.defaultSetupAmount
      : prev?.default_setup_amount != null
        ? Number(prev.default_setup_amount)
        : defaults.defaultSetupAmount

  const defaultRecurringAmount =
    input.defaultRecurringAmount !== undefined
      ? input.defaultRecurringAmount
      : prev?.default_recurring_amount != null
        ? Number(prev.default_recurring_amount)
        : defaults.defaultRecurringAmount

  const payload = {
    tenant_id: input.tenantId,
    product: PRODUCT,
    enabled: input.enabled,
    currency,
    schedule_anchor: scheduleAnchor,
    cycle_months: cycleMonths,
    default_setup_amount: defaultSetupAmount,
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
  void profile
  revalidateCash(input.tenantId)
  return mapTenant(data as Record<string, unknown>)
}

/** Refresh schedule defaults from a Nest subscription without toggling enabled. */
export async function syncCashDefaultsFromSubscription(
  tenantId: string,
  subscription: Record<string, unknown> | null
): Promise<OpsCashTenant> {
  await requireOpsAdmin()
  const defaults = cashDefaultsFromSubscription(subscription)
  return upsertCashSettings({
    tenantId,
    enabled: true,
    scheduleAnchor: defaults.scheduleAnchor,
    cycleMonths: defaults.cycleMonths,
    defaultSetupAmount: defaults.defaultSetupAmount,
    defaultRecurringAmount: defaults.defaultRecurringAmount,
    currency: defaults.currency,
    subscription,
  })
}

export type CreateCashCollectionInput = {
  tenantId: string
  kind: CashCollectionKind
  amount: number
  currency: string
  dueDate: string
  collectedOn?: string
  notes?: string | null
}

export async function createCashCollection(
  input: CreateCashCollectionInput
): Promise<OpsCashCollection> {
  const profile = await requireOpsAdmin()
  const supabase = await createClient()

  if (!(input.amount >= 0) || !Number.isFinite(input.amount)) {
    throw new Error('Amount must be a non-negative number')
  }
  if (!['setup', 'recurring', 'other'].includes(input.kind)) {
    throw new Error('Invalid collection type')
  }

  const { data, error } = await supabase
    .from('ops_cash_collections')
    .insert({
      tenant_id: input.tenantId,
      product: PRODUCT,
      kind: input.kind,
      amount: input.amount,
      currency: input.currency || 'USD',
      due_date: input.dueDate.slice(0, 10),
      collected_on: (input.collectedOn ?? todayISO()).slice(0, 10),
      notes: input.notes?.trim() || null,
      collected_by: profile.id,
    })
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
  kind?: CashCollectionKind
  amount?: number
  currency?: string
  dueDate?: string
  collectedOn?: string
  notes?: string | null
}

export async function updateCashCollection(
  input: UpdateCashCollectionInput
): Promise<OpsCashCollection> {
  await requireOpsAdmin()
  const supabase = await createClient()

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.amount !== undefined) {
    if (!(input.amount >= 0) || !Number.isFinite(input.amount)) {
      throw new Error('Amount must be a non-negative number')
    }
    patch.amount = input.amount
  }
  if (input.currency !== undefined) patch.currency = input.currency
  if (input.dueDate !== undefined) patch.due_date = input.dueDate.slice(0, 10)
  if (input.collectedOn !== undefined)
    patch.collected_on = input.collectedOn.slice(0, 10)
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  const { data, error } = await supabase
    .from('ops_cash_collections')
    .update(patch)
    .eq('id', input.id)
    .eq('product', PRODUCT)
    .eq('tenant_id', input.tenantId)
    .select('*')
    .single()

  assertNoError(error, 'Failed to update collection')
  assertRows(data ? [data] : null)
  revalidateCash(input.tenantId)
  return mapCollection(data as Record<string, unknown>)
}

export async function deleteCashCollection(
  id: string,
  tenantId: string
): Promise<void> {
  await requireOpsAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('ops_cash_collections')
    .delete()
    .eq('id', id)
    .eq('product', PRODUCT)
    .eq('tenant_id', tenantId)

  assertNoError(error, 'Failed to delete collection')
  revalidateCash(tenantId)
}
