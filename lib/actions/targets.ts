'use server'

import { assertNoError } from '@/lib/assert'
import { getCachedProfile } from '@/lib/dataCache'
import { isCrmManager } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireCrmManager() {
  const profile = await getCachedProfile()
  if (!isCrmManager(profile)) {
    throw new Error('Only CRM managers can manage targets')
  }
  return profile
}

function revalidateTargets() {
  revalidatePath('/reports')
  revalidatePath('/settings/targets')
}

export async function createTarget(data: {
  user_id: string
  label: string
  start_date: string
  end_date: string
  currency?: string
  leads_target?: number | null
  revenue_target?: number | null
}) {
  await requireCrmManager()
  const supabase = createClient()
  const { error } = await supabase.from('targets').insert({
    user_id: data.user_id,
    label: data.label,
    start_date: data.start_date,
    end_date: data.end_date,
    currency: data.currency ?? 'PKR',
    leads_target: data.leads_target ?? null,
    revenue_target: data.revenue_target ?? null,
    // Deprecated fields — keep null so reports ignore them
    setup_fee_target: null,
    mrr_target: null,
  })
  assertNoError(error)
  revalidateTargets()
}

export async function updateTarget(
  id: string,
  data: {
    label?: string
    start_date?: string
    end_date?: string
    currency?: string
    leads_target?: number | null
    revenue_target?: number | null
  }
) {
  await requireCrmManager()
  const supabase = createClient()
  const { error } = await supabase
    .from('targets')
    .update({
      ...data,
      setup_fee_target: null,
      mrr_target: null,
    })
    .eq('id', id)
  assertNoError(error)
  revalidateTargets()
}

export async function deleteTarget(id: string) {
  await requireCrmManager()
  const supabase = createClient()
  const { error } = await supabase.from('targets').delete().eq('id', id)
  assertNoError(error)
  revalidateTargets()
}
