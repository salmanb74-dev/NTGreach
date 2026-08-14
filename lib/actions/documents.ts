'use server'

import { assertNoError } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type DocumentTemplateKind = 'contract' | 'quotation'

const TEMPLATE_TABLE: Record<DocumentTemplateKind, string> = {
  contract: 'contract_templates',
  quotation: 'quotation_templates',
}

const SETTINGS_PATH: Record<DocumentTemplateKind, string> = {
  contract: '/settings/contracts',
  quotation: '/settings/quotation-templates',
}

const DOC_TABLE: Record<DocumentTemplateKind, string> = {
  contract: 'contracts',
  quotation: 'quotations',
}

const TEMPLATE_DELETE_HINT =
  'Could not delete template. You may need CRM Admin/Manager permission, or run supabase/fix_template_rls_crm_roles.sql.'

export async function saveDocumentTemplate(
  kind: DocumentTemplateKind,
  id: string | null,
  name: string,
  content: string
) {
  const supabase = createClient()
  const table = TEMPLATE_TABLE[kind]
  if (id) {
    const { error } = await supabase
      .from(table)
      .update({ name, content })
      .eq('id', id)
    assertNoError(error)
  } else {
    const { error } = await supabase.from(table).insert({ name, content })
    assertNoError(error)
  }
  revalidatePath(SETTINGS_PATH[kind])
}

export async function deleteDocumentTemplate(
  kind: DocumentTemplateKind,
  id: string
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from(TEMPLATE_TABLE[kind])
    .delete()
    .eq('id', id)
    .select('id')

  assertNoError(error)
  if (!data?.length) throw new Error(TEMPLATE_DELETE_HINT)
  revalidatePath(SETTINGS_PATH[kind])
}

export async function saveGeneratedDocument(
  kind: DocumentTemplateKind,
  data: {
    lead_id?: string
    template_id?: string
    name: string
    content: string
    variables: Record<string, string>
  }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: row, error } = await supabase
    .from(DOC_TABLE[kind])
    .insert({ ...data, created_by: user!.id })
    .select()
    .single()
  assertNoError(error)
  if (data.lead_id) revalidatePath(`/leads/${data.lead_id}`)
  return row
}
