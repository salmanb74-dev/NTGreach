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

/** Case-insensitive exact match for PostgREST `ilike` (escape % _ \). */
function escapeIlikeExact(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function assertUniqueCompanyName(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  excludeId?: string,
) {
  const name = companyName.trim()
  if (!name) return

  let query = supabase
    .from('leads')
    .select('id')
    .ilike('company_name', escapeIlikeExact(name))
    .limit(1)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: existing, error } = await query
  assertNoError(error)

  if (existing && existing.length > 0) {
    throw new Error(
      `"${name}" already exists. Please give a different name.`,
    )
  }
}

export async function createLead(data: LeadFormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await assertUniqueCompanyName(supabase, data.company_name)

  const { getDealQuoteDefaults } = await import('@/lib/dataCache')
  const {
    leadFieldsFromDealDefaults,
  } = await import('@/lib/subscription-quote')
  const defaults = leadFieldsFromDealDefaults(await getDealQuoteDefaults())

  const insert = {
    ...defaults,
    ...data,
    company_name: data.company_name.trim(),
    contact_name: data.contact_name.trim(),
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

  if (error?.code === '23505') {
    throw new Error(
      `"${data.company_name.trim()}" already exists. Please give a different name.`,
    )
  }
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

  if (data.company_name !== undefined) {
    await assertUniqueCompanyName(supabase, data.company_name, id)
    data = { ...data, company_name: data.company_name.trim() }
  }
  if (data.contact_name !== undefined) {
    data = { ...data, contact_name: data.contact_name.trim() }
  }

  // Check if stage changed
  if (data.stage) {
    const { data: existing } = await supabase
      .from('leads')
      .select('stage, closed_at, payment_start_date')
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

      // Stamp closed_at + subscription start for Paid / Closed Won / Lost
      // when not already set by caller. Blank/"immediate" → today.
      const closing =
        data.stage === 'payment_received' ||
        data.stage === 'closed_won' ||
        data.stage === 'closed_lost'
      const now = new Date().toISOString()

      if (data.closed_at === undefined) {
        data = { ...data, closed_at: closing ? now : null }
      }

      // Only fill subscription start on Paid if still empty (immediate)
      if (
        data.stage === 'payment_received' &&
        data.payment_start_date === undefined &&
        !existing.payment_start_date
      ) {
        data = { ...data, payment_start_date: now }
      }
    }
  }

  const { error } = await supabase
    .from('leads')
    .update(data)
    .eq('id', id)

  if (error?.code === '23505') {
    throw new Error(
      `"${(data.company_name ?? '').trim()}" already exists. Please give a different name.`,
    )
  }
  assertNoError(error)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  revalidatePath('/reports')
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
