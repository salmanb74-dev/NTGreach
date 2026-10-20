'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getCachedProfile } from '@/lib/dataCache'
import type { OpsNestProduct } from '@/lib/ops/product'
import type { OpsReleaseNoteInput } from '@/lib/ops-release-notes/types'
import { isOpsProductAdmin } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function revalidateReleaseNotes(product: OpsNestProduct) {
  revalidatePath('/ops/releases')
  revalidatePath(`/ops_${product}/releases`)
  revalidatePath(`/releases/${product}`)
}

async function requireOpsProductAdmin(product: OpsNestProduct) {
  const profile = await getCachedProfile()
  if (!isOpsProductAdmin(profile, product)) {
    throw new Error('Forbidden — Ops Admin required')
  }
  return profile!
}

function normalizeInput(input: OpsReleaseNoteInput) {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required')

  const version = input.version?.trim() || null
  const body_html = input.body_html?.trim() || ''
  const is_published = !!input.is_published

  let published_at: string | null = null
  if (is_published) {
    if (input.published_at) {
      const d = new Date(input.published_at)
      if (Number.isNaN(d.getTime())) throw new Error('Invalid publish date')
      published_at = d.toISOString()
    } else {
      published_at = new Date().toISOString()
    }
  }

  return { title, version, body_html, is_published, published_at }
}

export async function createOpsReleaseNote(
  product: OpsNestProduct,
  input: OpsReleaseNoteInput
) {
  const profile = await requireOpsProductAdmin(product)
  const payload = normalizeInput(input)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ops_release_notes')
    .insert({
      product,
      ...payload,
      created_by: profile.id,
    })
    .select('id')

  assertNoError(error)
  assertRows(data, 'Could not create release note')
  revalidateReleaseNotes(product)
}

export async function updateOpsReleaseNote(
  product: OpsNestProduct,
  id: string,
  input: OpsReleaseNoteInput
) {
  await requireOpsProductAdmin(product)
  const payload = normalizeInput(input)
  const supabase = createClient()

  // Keep existing published_at when republishing without a new date
  if (payload.is_published && !input.published_at) {
    const { data: existing, error: fetchErr } = await supabase
      .from('ops_release_notes')
      .select('published_at, is_published')
      .eq('id', id)
      .eq('product', product)
      .maybeSingle()
    assertNoError(fetchErr)
    if (existing?.published_at) {
      payload.published_at = existing.published_at as string
    }
  }

  const { data, error } = await supabase
    .from('ops_release_notes')
    .update(payload)
    .eq('id', id)
    .eq('product', product)
    .select('id')

  assertNoError(error)
  assertRows(data, 'Could not update release note')
  revalidateReleaseNotes(product)
}

export async function deleteOpsReleaseNote(
  product: OpsNestProduct,
  id: string
) {
  await requireOpsProductAdmin(product)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ops_release_notes')
    .delete()
    .eq('id', id)
    .eq('product', product)
    .select('id')

  assertNoError(error)
  assertRows(data, 'Could not delete release note')
  revalidateReleaseNotes(product)
}
