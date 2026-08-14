import { NextRequest } from 'next/server'
import { getDocumentTemplateJson } from '@/lib/document-templates-api'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return getDocumentTemplateJson('contract', params.id)
}
