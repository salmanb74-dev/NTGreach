'use server'

import { assertNoError } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { PipelineStage, LeadSource } from '@/lib/types'

export interface LeadFormData {
  company_name:       string
  contact_name:       string
  email?:             string
  phone?:             string
  city?:              string
  address?:           string
  restaurant_type?:   string
  source?:            LeadSource
  stage:              PipelineStage
  notes?:             string
  quoted_setup_fee?:  number | null
  quoted_mrr?:        number | null
  deal_currency?:     string
  discount?:          number | null
  tax_rate?:          number | null
  closed_at?:         string | null
  payment_start_date?: string | null
  payment_frequency?: string | null
  quoted_subscription?: Record<string, unknown> | null
  lost_reason?: string | null
}

export async function createLead(data: LeadFormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { getDealQuoteDefaults } = await import('@/lib/dataCache')
  const {
    leadFieldsFromDealDefaults,
  } = await import('@/lib/subscription-quote')
  const defaults = leadFieldsFromDealDefaults(await getDealQuoteDefaults())

  const insert = {
    ...defaults,
    ...data,
    // Only fill deal fields from defaults when caller left them unset
    deal_currency: data.deal_currency ?? defaults.deal_currency,
    quoted_mrr: data.quoted_mrr ?? defaults.quoted_mrr,
    quoted_setup_fee: data.quoted_setup_fee ?? defaults.quoted_setup_fee,
    payment_frequency: data.payment_frequency ?? defaults.payment_frequency,
    quoted_subscription:
      data.quoted_subscription ?? defaults.quoted_subscription,
    created_by: user!.id,
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert(insert)
    .select()
    .single()

  assertNoError(error)

  // Log creation activity
  await supabase.from('activities').insert({
    lead_id: lead.id,
    type: 'note',
    subject: 'Lead created',
    created_by: user!.id,
  })

  revalidatePath('/leads')
  redirect(`/leads/${lead.id}`)
}

export async function updateLead(id: string, data: Partial<LeadFormData>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if stage changed
  if (data.stage) {
    const { data: existing } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', id)
      .single()

    if (existing && existing.stage !== data.stage) {
      await supabase.from('activities').insert({
        lead_id: id,
        type: 'stage_change',
        subject: `Stage changed to ${data.stage.replace(/_/g, ' ')}`,
        metadata: { from: existing.stage, to: data.stage },
        created_by: user!.id,
      })
    }
  }

  const { error } = await supabase
    .from('leads')
    .update(data)
    .eq('id', id)

  assertNoError(error)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
}

export async function deleteLead(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('leads').delete().eq('id', id)
  assertNoError(error)
  revalidatePath('/leads')
  redirect('/leads')
}

export async function updateLeadStage(id: string, stage: PipelineStage) {
  await updateLead(id, { stage })
  revalidatePath('/pipeline')
}
