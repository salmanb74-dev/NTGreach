'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTemplate(id: string | null, name: string, content: string) {
  const supabase = createClient()
  if (id) {
    const { error } = await supabase
      .from('contract_templates')
      .update({ name, content })
      .eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('contract_templates')
      .insert({ name, content })
    if (error) throw new Error(error.message)
  }
  revalidatePath('/settings/contracts')
}

export async function deleteTemplate(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('contract_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/contracts')
}

export async function saveContract(data: {
  lead_id?:     string
  template_id?: string
  name:         string
  content:      string
  variables:    Record<string, string>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({ ...data, created_by: user!.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/leads/${data.lead_id}`)
  return contract
}
