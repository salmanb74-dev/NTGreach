'use server'

import { assertNoError } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTarget(data: {
  user_id:          string
  label:            string
  start_date:       string
  end_date:         string
  leads_target?:    number | null
  setup_fee_target?: number | null
  mrr_target?:      number | null
  revenue_target?:  number | null
}) {
  const supabase = createClient()
  const { error } = await supabase.from('targets').insert(data)
  assertNoError(error)
  revalidatePath('/reports')
}

export async function updateTarget(id: string, data: {
  label?:           string
  start_date?:      string
  end_date?:        string
  leads_target?:    number | null
  setup_fee_target?: number | null
  mrr_target?:      number | null
  revenue_target?:  number | null
}) {
  const supabase = createClient()
  const { error } = await supabase.from('targets').update(data).eq('id', id)
  assertNoError(error)
  revalidatePath('/reports')
}

export async function deleteTarget(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('targets').delete().eq('id', id)
  assertNoError(error)
  revalidatePath('/reports')
}
