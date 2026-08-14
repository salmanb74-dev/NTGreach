'use server'

import {
  saveDocumentTemplate,
  deleteDocumentTemplate,
  saveGeneratedDocument,
} from '@/lib/actions/documents'

export async function saveTemplate(
  id: string | null,
  name: string,
  content: string
) {
  return saveDocumentTemplate('contract', id, name, content)
}

export async function deleteTemplate(id: string) {
  return deleteDocumentTemplate('contract', id)
}

export async function saveContract(data: {
  lead_id?: string
  template_id?: string
  name: string
  content: string
  variables: Record<string, string>
}) {
  return saveGeneratedDocument('contract', data)
}
