'use client'

import DocumentGenerator from '@/components/documents/DocumentGenerator'
import {
  QUOTATION_VARIABLES,
  QUOTATION_DEAL_KEYS,
} from '@/lib/quotations'
import { saveQuotation } from '@/lib/actions/quotations'

interface Template {
  id: string
  name: string
  is_default: boolean
}

export default function QuotationGenerator({
  templates,
  lead,
  prefilled,
}: {
  templates: Template[]
  lead: { id: string; company_name: string } | null
  prefilled: Record<string, string>
  inputCurrency: string
}) {
  return (
    <DocumentGenerator
      templates={templates}
      lead={lead}
      prefilled={prefilled}
      config={{
        kind: 'quotation',
        noun: 'Quotation',
        variables: QUOTATION_VARIABLES,
        dealKeys: QUOTATION_DEAL_KEYS,
        templateFetchPath: id => `/api/quotations/template/${id}`,
        saveDocument: saveQuotation,
        namePlaceholder: 'e.g. Spice Garden — Q1 2026 Quotation',
      }}
    />
  )
}
