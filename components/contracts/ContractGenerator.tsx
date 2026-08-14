'use client'

import DocumentGenerator from '@/components/documents/DocumentGenerator'
import {
  CONTRACT_VARIABLES,
  CONTRACT_DEAL_KEYS,
} from '@/lib/contracts'
import { saveContract } from '@/lib/actions/contracts'

interface Template {
  id: string
  name: string
  is_default: boolean
}

export default function ContractGenerator({
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
        kind: 'contract',
        noun: 'Contract',
        variables: CONTRACT_VARIABLES,
        dealKeys: CONTRACT_DEAL_KEYS,
        templateFetchPath: id => `/api/contracts/template/${id}`,
        saveDocument: saveContract,
        namePlaceholder: 'e.g. Spice Garden — Q1 2026 Contract',
        summaryLabel: 'Live Preview',
      }}
    />
  )
}
