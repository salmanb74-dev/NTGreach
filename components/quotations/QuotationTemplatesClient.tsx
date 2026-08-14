'use client'

import TemplatesClient from '@/components/documents/TemplatesClient'
import { QUOTATION_VARIABLES } from '@/lib/quotations'
import {
  saveQuotationTemplate,
  deleteQuotationTemplate,
} from '@/lib/actions/quotations'

interface Template {
  id: string
  name: string
  is_default: boolean
  updated_at: string
}

export default function QuotationTemplatesClient({
  templates,
  previewVars,
}: {
  templates: Template[]
  previewVars?: Record<string, string>
}) {
  return (
    <TemplatesClient
      templates={templates}
      previewVars={previewVars}
      config={{
        noun: 'Quotation',
        variables: QUOTATION_VARIABLES,
        templateFetchPath: id => `/api/quotations/template/${id}`,
        saveTemplate: saveQuotationTemplate,
        deleteTemplate: deleteQuotationTemplate,
        newTemplateName: 'New Quotation Template',
        newTemplateHtml:
          '<h1>QUOTATION</h1><p>Enter quotation content here. Use <strong>{{variable}}</strong> placeholders.</p>',
        editorPlaceholder: 'Write your quotation template here…',
        emptyListHint:
          'No templates yet. The default will be created when you run the Phase F migration.',
      }}
    />
  )
}
