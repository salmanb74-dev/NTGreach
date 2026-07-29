'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/roles'

// ─── Enumerations ─────────────────────────────────────────────
export async function addEnumeration(category: string, value: string, label: string) {
  const supabase = createClient()
  const maxOrder = await supabase
    .from('enumerations')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = ((maxOrder.data?.sort_order ?? 0) as number) + 1

  const { error } = await supabase.from('enumerations').insert({
    category,
    value: value.toLowerCase().replace(/\s+/g, '_'),
    label: label.trim(),
    sort_order: nextOrder,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/settings/enumerations')
}

export async function updateEnumeration(id: string, label: string, isActive: boolean) {
  const supabase = createClient()
  const { error } = await supabase
    .from('enumerations')
    .update({ label: label.trim(), is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/enumerations')
}

export async function deleteEnumeration(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('enumerations').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/enumerations')
}

export async function reorderEnumeration(id: string, direction: 'up' | 'down') {
  const supabase = createClient()
  const { data: item } = await supabase
    .from('enumerations')
    .select('sort_order, category')
    .eq('id', id)
    .single()
  if (!item) return

  const newOrder = direction === 'up' ? item.sort_order - 1 : item.sort_order + 1

  // Swap with neighbour
  const { data: neighbour } = await supabase
    .from('enumerations')
    .select('id')
    .eq('category', item.category)
    .eq('sort_order', newOrder)
    .single()

  if (neighbour) {
    await supabase.from('enumerations').update({ sort_order: item.sort_order }).eq('id', neighbour.id)
  }
  await supabase.from('enumerations').update({ sort_order: newOrder }).eq('id', id)
  revalidatePath('/settings/enumerations')
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
  if (error) throw new Error(error.message)
  revalidatePath('/settings/users')
}

// ─── App Settings ─────────────────────────────────────────────
export async function updateAppSetting(key: string, value: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}
