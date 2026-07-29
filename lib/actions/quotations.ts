'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveQuotationTemplate(id: string | null, name: string, content: string) {
  const supabase = createClient()
  if (id) {
    const { error } = await supabase.from('quotation_templates').update({ name, content }).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('quotation_templates').insert({ name, content })
    if (error) throw new Error(error.message)
  }
  revalidatePath('/settings/quotation-templates')
}

export async function deleteQuotationTemplate(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('quotation_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/quotation-templates')
}

export async function saveQuotation(data: {
  lead_id?:     string
  template_id?: string
  name:         string
  content:      string
  variables:    Record<string, string>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: quotation, error } = await supabase
    .from('quotations')
    .insert({ ...data, created_by: user!.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/leads/${data.lead_id}`)
  return quotation
}
