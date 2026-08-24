'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getCachedProfile } from '@/lib/dataCache'
import {
  hasPlatformOpsAccess,
  isPlatformOpsAdmin,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OpsDocKind } from '@/lib/ops-docs/types'

function revalidateOpsDocs() {
  revalidatePath('/ops/docs')
  revalidatePath('/ops/settings')
  revalidatePath('/ops/settings/enumerations')
}

async function requirePlatformOps() {
  const profile = await getCachedProfile()
  if (!hasPlatformOpsAccess(profile)) {
    throw new Error('Forbidden')
  }
  return profile!
}

async function requireOpsAdmin() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) {
    throw new Error('Only Ops Admins can edit Lists & Values')
  }
  return profile!
}

function slugifyValue(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function assertHttpUrl(url: string) {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must start with https://')
  }
  return trimmed
}

// ─── Enumerations ─────────────────────────────────────────────

export async function addOpsEnumeration(
  category: string,
  label: string
) {
  await requireOpsAdmin()
  const supabase = createClient()
  const { data: maxRow } = await supabase
    .from('ops_enumerations')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow?.sort_order ?? 0) as number) + 1
  const value = slugifyValue(label)
  if (!value) throw new Error('Label is required')

  const { data, error } = await supabase
    .from('ops_enumerations')
    .insert({
      category,
      value,
      label: label.trim(),
      sort_order: nextOrder,
    })
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not add item')
  revalidateOpsDocs()
}

export async function updateOpsEnumeration(
  id: string,
  label: string,
  isActive: boolean
) {
  await requireOpsAdmin()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ops_enumerations')
    .update({ label: label.trim(), is_active: isActive })
    .eq('id', id)
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not save — item not found')
  revalidateOpsDocs()
}

export async function deleteOpsEnumeration(id: string) {
  await requireOpsAdmin()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ops_enumerations')
    .delete()
    .eq('id', id)
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not delete — item not found')
  revalidateOpsDocs()
}

export async function reorderOpsEnumeration(
  id: string,
  direction: 'up' | 'down'
) {
  await requireOpsAdmin()
  const supabase = createClient()
  const { data: item, error: fetchError } = await supabase
    .from('ops_enumerations')
    .select('id, sort_order, category')
    .eq('id', id)
    .single()
  assertNoError(fetchError)
  if (!item) throw new Error('Item not found')

  const { data: siblings, error: listError } = await supabase
    .from('ops_enumerations')
    .select('id, sort_order')
    .eq('category', item.category)
    .order('sort_order', { ascending: true })
  assertNoError(listError)

  const list = siblings ?? []
  const idx = list.findIndex(s => s.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return

  const other = list[swapIdx]
  const a = item.sort_order
  const b = other.sort_order

  const { error: e1 } = await supabase
    .from('ops_enumerations')
    .update({ sort_order: b })
    .eq('id', item.id)
  assertNoError(e1)
  const { error: e2 } = await supabase
    .from('ops_enumerations')
    .update({ sort_order: a })
    .eq('id', other.id)
  assertNoError(e2)
  revalidateOpsDocs()
}

// ─── Docs ─────────────────────────────────────────────────────

export type OpsDocInput = {
  title: string
  url: string
  kind: OpsDocKind
  category_value: string
  subcategory_value: string
  description?: string | null
}

export async function createOpsDoc(input: OpsDocInput) {
  const profile = await requirePlatformOps()
  const supabase = createClient()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')
  if (!input.category_value?.trim()) throw new Error('Category is required')
  if (!input.subcategory_value?.trim()) throw new Error('Subcategory is required')
  if (input.kind !== 'folder' && input.kind !== 'file') {
    throw new Error('Type must be folder or file')
  }

  const { data: maxRow } = await supabase
    .from('ops_docs')
    .select('sort_order')
    .eq('category_value', input.category_value.trim())
    .eq('subcategory_value', input.subcategory_value.trim())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxRow?.sort_order ?? 0) as number) + 1

  const { data, error } = await supabase
    .from('ops_docs')
    .insert({
      title,
      url: assertHttpUrl(input.url),
      kind: input.kind,
      category_value: input.category_value.trim(),
      subcategory_value: input.subcategory_value.trim(),
      description: input.description?.trim() || null,
      sort_order: nextOrder,
      created_by: profile.id,
    })
    .select('id')
  assertNoError(error)
  assertRows(data, 'Could not create doc link')
  revalidateOpsDocs()
}

export async function updateOpsDoc(id: string, input: OpsDocInput) {
  const profile = await requirePlatformOps()
  const supabase = createClient()
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')
  if (!input.category_value?.trim()) throw new Error('Category is required')
  if (!input.subcategory_value?.trim()) throw new Error('Subcategory is required')
  if (input.kind !== 'folder' && input.kind !== 'file') {
    throw new Error('Type must be folder or file')
  }

  let query = supabase
    .from('ops_docs')
    .update({
      title,
      url: assertHttpUrl(input.url),
      kind: input.kind,
      category_value: input.category_value.trim(),
      subcategory_value: input.subcategory_value.trim(),
      description: input.description?.trim() || null,
    })
    .eq('id', id)

  if (!isPlatformOpsAdmin(profile)) {
    query = query.eq('created_by', profile.id)
  }

  const { data, error } = await query.select('id')
  assertNoError(error)
  assertRows(data, 'Could not update — not found or not allowed')
  revalidateOpsDocs()
}

export async function deleteOpsDoc(id: string) {
  const profile = await requirePlatformOps()
  const supabase = createClient()

  let query = supabase.from('ops_docs').delete().eq('id', id)
  if (!isPlatformOpsAdmin(profile)) {
    query = query.eq('created_by', profile.id)
  }

  const { data, error } = await query.select('id')
  assertNoError(error)
  assertRows(data, 'Could not delete — not found or not allowed')
  revalidateOpsDocs()
}
