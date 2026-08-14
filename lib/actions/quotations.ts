'use server'

import {
  saveDocumentTemplate,
  deleteDocumentTemplate,
} from '@/lib/actions/documents'

export async function saveQuotationTemplate(
  id: string | null,
  name: string,
  content: string
) {
  return saveDocumentTemplate('quotation', id, name, content)
}

export async function deleteQuotationTemplate(id: string) {
  return deleteDocumentTemplate('quotation', id)
}
