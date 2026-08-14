import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type DocumentTemplateKind = 'contract' | 'quotation'

const TEMPLATE_TABLE: Record<DocumentTemplateKind, string> = {
  contract: 'contract_templates',
  quotation: 'quotation_templates',
}

export async function getDocumentTemplateJson(
  kind: DocumentTemplateKind,
  id: string
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from(TEMPLATE_TABLE[kind])
    .select('id, name, content')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
