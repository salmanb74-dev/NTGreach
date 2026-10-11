'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import { hasCsAccess, isCsAdmin } from '@/lib/roles'
import {
  CHECKLIST_PRODUCT,
  isChecklistItemStatus,
  isChecklistListType,
  unresolvedChecklistStatus,
  type ChecklistItem,
  type ChecklistItemStatus,
  type ChecklistLine,
  type ChecklistListType,
  type ChecklistRestaurant,
  type ChecklistStatusValue,
} from '@/lib/support/checklists'

async function requireCsAccess() {
  const profile = await getCachedProfile()
  if (!hasCsAccess(profile)) throw new Error('Not authorized')
  return profile!
}

async function requireCsAdmin() {
  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) throw new Error('Only CS admins can edit checklist items')
  return profile!
}

function revalidateChecklists(restaurantId?: string) {
  revalidatePath('/support/checklists')
  revalidatePath('/support/checklists/items')
  if (restaurantId) {
    revalidatePath(`/support/checklists/${restaurantId}`)
  }
}

export async function listChecklistRestaurants(): Promise<ChecklistRestaurant[]> {
  await requireCsAccess()
  const supabase = createClient()

  const { data, error } = await supabase
    .from('support_checklist_restaurants')
    .select('id, product, name, notes, created_by, created_at, updated_at')
    .eq('product', CHECKLIST_PRODUCT)
    .order('updated_at', { ascending: false })
  assertNoError(error)

  const rows = (data ?? []) as ChecklistRestaurant[]

  const { data: activeItems, error: itemsErr } = await supabase
    .from('support_checklist_items')
    .select('id')
    .eq('product', CHECKLIST_PRODUCT)
    .eq('is_active', true)
  assertNoError(itemsErr)

  const activeIds = new Set((activeItems ?? []).map(r => String(r.id)))
  const total = activeIds.size

  if (!rows.length || !total) {
    return rows.map(row => ({ ...row, total_count: total, pending_count: total }))
  }

  const { data: statuses, error: statusErr } = await supabase
    .from('support_checklist_statuses')
    .select('restaurant_id, item_id')
    .in(
      'restaurant_id',
      rows.map(r => r.id)
    )
  assertNoError(statusErr)

  const answered = new Map<string, number>()
  for (const row of statuses ?? []) {
    if (!activeIds.has(String(row.item_id))) continue
    const rid = String(row.restaurant_id)
    answered.set(rid, (answered.get(rid) ?? 0) + 1)
  }

  return rows.map(row => ({
    ...row,
    total_count: total,
    pending_count: Math.max(0, total - (answered.get(row.id) ?? 0)),
  }))
}

export async function getChecklistRestaurant(
  id: string
): Promise<{ restaurant: ChecklistRestaurant; lines: ChecklistLine[] }> {
  await requireCsAccess()
  const supabase = createClient()

  const { data: restaurant, error: restErr } = await supabase
    .from('support_checklist_restaurants')
    .select('id, product, name, notes, created_by, created_at, updated_at')
    .eq('id', id)
    .eq('product', CHECKLIST_PRODUCT)
    .maybeSingle()
  assertNoError(restErr)
  if (!restaurant) throw new Error('Restaurant checklist not found')

  const { data: items, error: itemsErr } = await supabase
    .from('support_checklist_items')
    .select('id, list_type, label, sort_order, created_at')
    .eq('product', CHECKLIST_PRODUCT)
    .eq('is_active', true)
    .order('list_type', { ascending: true })
    .order('sort_order', { ascending: true })
  assertNoError(itemsErr)

  const { data: statuses, error: statusErr } = await supabase
    .from('support_checklist_statuses')
    .select('item_id, status')
    .eq('restaurant_id', id)
  assertNoError(statusErr)

  const statusMap = new Map<string, ChecklistItemStatus>()
  for (const row of statuses ?? []) {
    if (isChecklistItemStatus(String(row.status))) {
      statusMap.set(String(row.item_id), row.status as ChecklistItemStatus)
    }
  }

  const restaurantCreatedAt = String(
    (restaurant as ChecklistRestaurant).created_at
  )

  const lines: ChecklistLine[] = (items ?? []).map(item => {
    const itemCreatedAt = String(item.created_at)
    const saved = statusMap.get(String(item.id))
    return {
      item_id: String(item.id),
      list_type: item.list_type as ChecklistListType,
      label: String(item.label),
      sort_order: Number(item.sort_order),
      item_created_at: itemCreatedAt,
      status: saved ?? unresolvedChecklistStatus(itemCreatedAt, restaurantCreatedAt),
    }
  })

  return { restaurant: restaurant as ChecklistRestaurant, lines }
}

export async function createChecklistRestaurant(
  name: string,
  notes?: string | null
): Promise<ChecklistRestaurant> {
  const profile = await requireCsAccess()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Restaurant name is required')

  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_checklist_restaurants')
    .insert({
      product: CHECKLIST_PRODUCT,
      name: trimmed,
      notes: notes?.trim() || null,
      created_by: profile.id,
    })
    .select('id, product, name, notes, created_by, created_at, updated_at')
    .single()
  assertNoError(error)
  if (!data) throw new Error('Failed to create restaurant checklist')

  revalidateChecklists()
  return data as ChecklistRestaurant
}

export async function updateChecklistRestaurant(
  id: string,
  patch: { name?: string; notes?: string | null }
): Promise<void> {
  await requireCsAccess()
  const updates: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    if (!trimmed) throw new Error('Restaurant name is required')
    updates.name = trimmed
  }
  if (patch.notes !== undefined) {
    updates.notes = patch.notes?.trim() || null
  }
  if (!Object.keys(updates).length) return

  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_checklist_restaurants')
    .update(updates)
    .eq('id', id)
    .eq('product', CHECKLIST_PRODUCT)
    .select('id')
  assertNoError(error)
  assertRows(data)

  revalidateChecklists(id)
}

export async function deleteChecklistRestaurant(id: string): Promise<void> {
  await requireCsAccess()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_checklist_restaurants')
    .delete()
    .eq('id', id)
    .eq('product', CHECKLIST_PRODUCT)
    .select('id')
  assertNoError(error)
  assertRows(data)
  revalidateChecklists()
}

export async function setChecklistItemStatus(
  restaurantId: string,
  itemId: string,
  status: ChecklistStatusValue
): Promise<void> {
  const profile = await requireCsAccess()
  const supabase = createClient()

  const touch = async () => {
    const { error } = await supabase
      .from('support_checklist_restaurants')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', restaurantId)
    assertNoError(error)
  }

  if (status === 'pending' || status === 'added_later') {
    // Clearing a mark — row absence means unanswered (pending or added_later in UI).
    const { error } = await supabase
      .from('support_checklist_statuses')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('item_id', itemId)
    assertNoError(error)
    await touch()
  } else {
    if (!isChecklistItemStatus(status)) throw new Error('Invalid status')
    const { error } = await supabase
      .from('support_checklist_statuses')
      .upsert(
        {
          restaurant_id: restaurantId,
          item_id: itemId,
          status,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'restaurant_id,item_id' }
      )
    assertNoError(error)
    await touch()
  }

  revalidateChecklists(restaurantId)
}

export async function listChecklistItems(
  listType?: ChecklistListType
): Promise<ChecklistItem[]> {
  await requireCsAdmin()
  const supabase = createClient()
  let query = supabase
    .from('support_checklist_items')
    .select('id, product, list_type, label, sort_order, is_active, created_at, updated_at')
    .eq('product', CHECKLIST_PRODUCT)
    .eq('is_active', true)
    .order('list_type', { ascending: true })
    .order('sort_order', { ascending: true })

  if (listType) {
    if (!isChecklistListType(listType)) throw new Error('Invalid list type')
    query = query.eq('list_type', listType)
  }

  const { data, error } = await query
  assertNoError(error)
  return (data ?? []) as ChecklistItem[]
}

export async function createChecklistItem(
  listType: ChecklistListType,
  label: string
): Promise<ChecklistItem> {
  await requireCsAdmin()
  if (!isChecklistListType(listType)) throw new Error('Invalid list type')
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Item label is required')

  const supabase = createClient()
  const { data: maxRow } = await supabase
    .from('support_checklist_items')
    .select('sort_order')
    .eq('product', CHECKLIST_PRODUCT)
    .eq('list_type', listType)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? 0) + 10

  const { data, error } = await supabase
    .from('support_checklist_items')
    .insert({
      product: CHECKLIST_PRODUCT,
      list_type: listType,
      label: trimmed,
      sort_order: nextOrder,
    })
    .select('id, product, list_type, label, sort_order, is_active, created_at, updated_at')
    .single()
  assertNoError(error)
  if (!data) throw new Error('Failed to create item')

  revalidateChecklists()
  return data as ChecklistItem
}

export async function updateChecklistItem(
  id: string,
  patch: { label?: string; sort_order?: number }
): Promise<void> {
  await requireCsAdmin()
  const updates: Record<string, unknown> = {}
  if (patch.label !== undefined) {
    const trimmed = patch.label.trim()
    if (!trimmed) throw new Error('Item label is required')
    updates.label = trimmed
  }
  if (patch.sort_order !== undefined) {
    updates.sort_order = patch.sort_order
  }
  if (!Object.keys(updates).length) return

  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_checklist_items')
    .update(updates)
    .eq('id', id)
    .eq('product', CHECKLIST_PRODUCT)
    .select('id')
  assertNoError(error)
  assertRows(data)
  revalidateChecklists()
}

export async function deactivateChecklistItem(id: string): Promise<void> {
  await requireCsAdmin()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_checklist_items')
    .update({ is_active: false })
    .eq('id', id)
    .eq('product', CHECKLIST_PRODUCT)
    .select('id')
  assertNoError(error)
  assertRows(data)
  revalidateChecklists()
}

export async function reorderChecklistItems(
  listType: ChecklistListType,
  orderedIds: string[]
): Promise<void> {
  await requireCsAdmin()
  if (!isChecklistListType(listType)) throw new Error('Invalid list type')
  if (!orderedIds.length) return

  const supabase = createClient()
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await supabase
        .from('support_checklist_items')
        .update({ sort_order: (index + 1) * 10 })
        .eq('id', id)
        .eq('product', CHECKLIST_PRODUCT)
        .eq('list_type', listType)
      assertNoError(error)
    })
  )
  revalidateChecklists()
}
