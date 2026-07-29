'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logWhatsApp(leadId: string, body: string, occurredAt: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('activities').insert({
    lead_id: leadId,
    type: 'whatsapp_log',
    subject: 'WhatsApp note',
    body,
    direction: 'outbound',
    created_by: user!.id,
    created_at: occurredAt,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/leads/${leadId}`)
}

export async function logCall(
  leadId: string,
  durationMinutes: number,
  outcome: string,
  notes: string,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('activities').insert({
    lead_id: leadId,
    type: 'call',
    subject: `Call — ${outcome}`,
    body: notes || null,
    duration_minutes: durationMinutes || null,
    outcome,
    created_by: user!.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/leads/${leadId}`)
}

export async function logNote(leadId: string, body: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('activities').insert({
    lead_id: leadId,
    type: 'note',
    subject: 'Note',
    body,
    created_by: user!.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/leads/${leadId}`)
}
