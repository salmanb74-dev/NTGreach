'use server'

import { assertNoError, assertRows } from '@/lib/assert'
import { getServiceRoleClient } from '@/lib/supabase/admin'
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

const TEMPLATE_SAVE_HINT =
  'Could not save template — CRM Admin/Manager permission required, or run supabase/fix_template_rls_crm_roles.sql'

const TEMPLATE_DELETE_HINT =
  'Could not delete template. You may need CRM Admin/Manager permission, or run supabase/fix_template_rls_crm_roles.sql.'

async function requireCrmManager() {
  const { getCachedProfile } = await import('@/lib/dataCache')
  const { isCrmManager } = await import('@/lib/roles')
  const profile = await getCachedProfile()
  if (!isCrmManager(profile)) {
    throw new Error('Only CRM Admins and Managers can edit templates')
  }
}

export async function saveDocumentTemplate(
  kind: DocumentTemplateKind,
  id: string | null,
  name: string,
  content: string
) {
  await requireCrmManager()
  const supabase = getServiceRoleClient()
  const table = TEMPLATE_TABLE[kind]
  if (id) {
    const { data, error } = await supabase
      .from(table)
      .update({ name, content })
      .eq('id', id)
      .select('id')
    assertNoError(error)
    assertRows(data, TEMPLATE_SAVE_HINT)
  } else {
    const { data, error } = await supabase
      .from(table)
      .insert({ name, content })
      .select('id')
    assertNoError(error)
    assertRows(data, TEMPLATE_SAVE_HINT)
  }
  revalidatePath(SETTINGS_PATH[kind])
}

export async function deleteDocumentTemplate(
  kind: DocumentTemplateKind,
  id: string
) {
  await requireCrmManager()
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from(TEMPLATE_TABLE[kind])
    .delete()
    .eq('id', id)
    .select('id')

  assertNoError(error)
  if (!data?.length) throw new Error(TEMPLATE_DELETE_HINT)
  revalidatePath(SETTINGS_PATH[kind])
}
