'use server'

import { assertNoError } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import { hasCsAccess, isCsAdmin, isCsManager } from '@/lib/roles'
import {
  fetchRestoTenants,
  isRestoAdminConfigured,
} from '@/lib/resto-admin/client'
import {
  assertDurationMinutes,
  monthDateRange,
  normalizeVisitDate,
  normalizeVisitTime,
  type SiteVisit,
  type SiteVisitCustomerOption,
  type SiteVisitInput,
  type SupportProduct,
} from '@/lib/support/site-visits'

const SELECT_COLS =
  'id, agent_id, product, visit_date, visit_time, duration_minutes, tenant_id, customer_name, notes, created_at, updated_at'

async function requireCsUser() {
  const profile = await getCachedProfile()
  if (!hasCsAccess(profile)) throw new Error('Not authorized')
  return profile!
}

function parseProduct(value: string): SupportProduct {
  if (value === 'resto' || value === 'alma') return value
  throw new Error('Invalid product')
}

function normalizeInput(input: SiteVisitInput) {
  const product = parseProduct(input.product)
  const visit_date = normalizeVisitDate(input.visit_date)
  const visit_time = normalizeVisitTime(input.visit_time)
  const duration_minutes = assertDurationMinutes(input.duration_minutes)
  const customer_name = input.customer_name.trim()
  if (!customer_name) throw new Error('Customer name is required')

  const tenant_id = input.tenant_id?.trim() || null
  const notes = input.notes?.trim() || null

  return {
    product,
    visit_date,
    visit_time,
    duration_minutes,
    tenant_id,
    customer_name,
    notes,
  }
}

export async function getSiteVisits(
  userId: string,
  month: number,
  year: number,
  product: SupportProduct
): Promise<SiteVisit[]> {
  const profile = await requireCsUser()
  if (!isCsManager(profile) && userId !== profile.id) {
    throw new Error('Not authorized')
  }

  const { startYmd, endYmd } = monthDateRange(year, month)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('support_site_visits')
    .select(SELECT_COLS)
    .eq('agent_id', userId)
    .eq('product', product)
    .gte('visit_date', startYmd)
    .lte('visit_date', endYmd)
    .order('visit_date', { ascending: false })
    .order('visit_time', { ascending: false })

  assertNoError(error)
  return (data ?? []) as SiteVisit[]
}

export async function createSiteVisit(input: SiteVisitInput): Promise<SiteVisit> {
  const profile = await requireCsUser()
  const row = normalizeInput(input)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('support_site_visits')
    .insert({
      agent_id: profile.id,
      ...row,
    })
    .select(SELECT_COLS)
    .single()

  assertNoError(error)
  revalidatePath('/support/visits')
  return data as SiteVisit
}

export async function updateSiteVisit(
  id: string,
  input: SiteVisitInput
): Promise<SiteVisit> {
  const profile = await requireCsUser()
  const supabase = createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('support_site_visits')
    .select('id, agent_id')
    .eq('id', id)
    .maybeSingle()

  assertNoError(fetchError)
  if (!existing) throw new Error('Visit not found')

  const canEdit = existing.agent_id === profile.id || isCsAdmin(profile)
  if (!canEdit) throw new Error('Not authorized')

  const row = normalizeInput(input)

  const { data, error } = await supabase
    .from('support_site_visits')
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  assertNoError(error)
  revalidatePath('/support/visits')
  return data as SiteVisit
}

export async function deleteSiteVisit(id: string): Promise<void> {
  const profile = await requireCsUser()
  const supabase = createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('support_site_visits')
    .select('id, agent_id')
    .eq('id', id)
    .maybeSingle()

  assertNoError(fetchError)
  if (!existing) throw new Error('Visit not found')

  const canDelete = existing.agent_id === profile.id || isCsAdmin(profile)
  if (!canDelete) throw new Error('Not authorized')

  const { error } = await supabase
    .from('support_site_visits')
    .delete()
    .eq('id', id)

  assertNoError(error)
  revalidatePath('/support/visits')
}

/** Customers for the picker: Resto tenants (prod) and/or chat tenants + custom. */
export async function getSiteVisitCustomers(
  product: SupportProduct
): Promise<SiteVisitCustomerOption[]> {
  await requireCsUser()
  const supabase = createClient()
  const byKey = new Map<string, SiteVisitCustomerOption>()

  function add(option: SiteVisitCustomerOption) {
    const name = option.name.trim()
    if (!name) return
    const key = option.tenant_id
      ? `id:${option.tenant_id}`
      : `name:${name.toLowerCase()}`
    if (!byKey.has(key)) {
      byKey.set(key, { tenant_id: option.tenant_id, name })
    }
  }

  if (product === 'resto' && isRestoAdminConfigured('production')) {
    try {
      const tenants = await fetchRestoTenants('production')
      for (const t of tenants) {
        add({ tenant_id: t.id, name: t.name })
      }
    } catch {
      // Fall through to conversation names if Nest is unreachable.
    }
  }

  const { data: conversations } = await supabase
    .from('support_conversations')
    .select('tenant_id, tenant_name')
    .eq('product', product)
    .order('tenant_name')
    .limit(2000)

  for (const row of conversations ?? []) {
    add({
      tenant_id: String(row.tenant_id),
      name:      String(row.tenant_name),
    })
  }

  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}
