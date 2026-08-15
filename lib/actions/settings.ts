'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/roles'

// ─── Enumerations ─────────────────────────────────────────────
async function requireCrmAdmin() {
  const { getCachedProfile } = await import('@/lib/dataCache')
  const { isCrmAdmin } = await import('@/lib/roles')
  const profile = await getCachedProfile()
  if (!isCrmAdmin(profile)) {
    throw new Error('Only CRM Admins can edit Lists & Values')
  }
}

function parseBillingCycleMonths(raw: string): string {
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Billing cycle value must be months as a whole number (e.g. 12)')
  }
  return String(n)
}

function revalidateEnumerations() {
  revalidatePath('/settings/enumerations')
  revalidatePath('/settings')
  revalidatePath('/settings/quotation-templates')
  revalidatePath('/settings/contracts')
  revalidatePath('/leads')
}

export async function addEnumeration(category: string, value: string, label: string) {
  await requireCrmAdmin()
  const supabase = getServiceRoleClient()
  const maxOrder = await supabase
    .from('enumerations')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxOrder.data?.sort_order ?? 0) as number) + 1

  const storedValue =
    category === 'currency'
      ? value.trim().toUpperCase().replace(/\s+/g, '_')
      : category === 'billing_cycle'
        ? parseBillingCycleMonths(value)
        : value.toLowerCase().replace(/\s+/g, '_')

  const { data, error } = await supabase
    .from('enumerations')
    .insert({
      category,
      value: storedValue,
      label: label.trim(),
      sort_order: nextOrder,
    })
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not add item')
  revalidateEnumerations()
}

export async function updateEnumeration(
  id: string,
  label: string,
  isActive: boolean,
  value?: string
) {
  await requireCrmAdmin()
  const supabase = getServiceRoleClient()
  const patch: { label: string; is_active: boolean; value?: string } = {
    label: label.trim(),
    is_active: isActive,
  }
  if (value != null) {
    const { data: item, error: fetchError } = await supabase
      .from('enumerations')
      .select('category')
      .eq('id', id)
      .single()
    assertNoError(fetchError)
    if (item?.category === 'billing_cycle') {
      patch.value = parseBillingCycleMonths(value)
    }
  }
  const { data, error } = await supabase
    .from('enumerations')
    .update(patch)
    .eq('id', id)
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not save — item not found')
  revalidateEnumerations()
}

export async function deleteEnumeration(id: string) {
  await requireCrmAdmin()
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('enumerations')
    .delete()
    .eq('id', id)
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not delete — item not found')
  revalidateEnumerations()
}

export async function reorderEnumeration(id: string, direction: 'up' | 'down') {
  await requireCrmAdmin()
  const supabase = getServiceRoleClient()
  const { data: item, error: fetchError } = await supabase
    .from('enumerations')
    .select('sort_order, category')
    .eq('id', id)
    .single()
  assertNoError(fetchError)
  if (!item) throw new Error('Item not found')

  const newOrder = direction === 'up' ? item.sort_order - 1 : item.sort_order + 1

  const { data: neighbour, error: neighbourError } = await supabase
    .from('enumerations')
    .select('id')
    .eq('category', item.category)
    .eq('sort_order', newOrder)
    .maybeSingle()
  assertNoError(neighbourError)

  if (neighbour) {
    const { data: swapped, error: swapError } = await supabase
      .from('enumerations')
      .update({ sort_order: item.sort_order })
      .eq('id', neighbour.id)
      .select('id')
    assertNoError(swapError)
    assertRows(swapped)
  }

  const { data: moved, error: moveError } = await supabase
    .from('enumerations')
    .update({ sort_order: newOrder })
    .eq('id', id)
    .select('id')
  assertNoError(moveError)
  assertRows(moved)
  revalidateEnumerations()
}

// ─── Users & Roles ────────────────────────────────────────────
export async function updateUserRoles(userId: string, roles: UserRole[]) {
  const supabase = createClient()
  // Ensure at least one role always set
  const finalRoles = roles.length === 0 ? ['crm_sales_rep'] : roles
  const { error } = await supabase
    .from('profiles')
    .update({ roles: finalRoles })
    .eq('id', userId)
  assertNoError(error)
  revalidatePath('/settings/users')
  revalidatePath('/platform/users')
}

// ─── App Settings ─────────────────────────────────────────────
export async function updateAppSetting(key: string, value: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  assertNoError(error)
  revalidatePath('/settings')
  revalidatePath('/leads')
}

export async function saveDealQuoteDefaults(payload: {
  currency: string
  billingCycle: string
  subscription: Record<string, unknown>
}) {
  const {
    DEAL_QUOTE_DEFAULTS_SETTING_KEY,
    parseDealQuoteDefaults,
    serializeDealQuoteDefaults,
  } = await import('@/lib/subscription-quote')

  const normalized = parseDealQuoteDefaults({
    currency: payload.currency,
    billingCycle: payload.billingCycle,
    subscription: payload.subscription,
  })

  await updateAppSetting(
    DEAL_QUOTE_DEFAULTS_SETTING_KEY,
    serializeDealQuoteDefaults(normalized)
  )
}
