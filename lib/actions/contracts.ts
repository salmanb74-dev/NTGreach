'use server'

import {
  saveDocumentTemplate,
  deleteDocumentTemplate,
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
