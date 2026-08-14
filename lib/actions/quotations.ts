'use server'

import {
  saveDocumentTemplate,
  deleteDocumentTemplate,
  saveGeneratedDocument,
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

export async function saveQuotation(data: {
  lead_id?: string
  template_id?: string
  name: string
  content: string
  variables: Record<string, string>
}) {
  return saveGeneratedDocument('quotation', data)
}
