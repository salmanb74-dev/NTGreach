'use client'

import TemplatesClient from '@/components/documents/TemplatesClient'
import { CONTRACT_VARIABLES } from '@/lib/contracts'
import { saveTemplate, deleteTemplate } from '@/lib/actions/contracts'

interface Template {
  id: string
  name: string
  is_default: boolean
  updated_at: string
}

export default function ContractTemplatesClient({
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
        noun: 'Contract',
        variables: CONTRACT_VARIABLES,
        templateFetchPath: id => `/api/contracts/template/${id}`,
        saveTemplate,
        deleteTemplate,
        newTemplateName: 'New Contract Template',
        newTemplateHtml:
          '<h1>SAAS SUBSCRIPTION AGREEMENT</h1><p>Enter contract terms here. Use <strong>{{variable}}</strong> placeholders.</p>',
        editorPlaceholder: 'Write your contract template here…',
        emptyListHint:
          'No templates yet. Create one or run the subscription quote migration.',
      }}
    />
  )
}
