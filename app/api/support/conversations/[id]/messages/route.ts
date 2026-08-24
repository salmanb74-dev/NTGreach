import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  clampLimit,
  getConversationForTenant,
  getSupportAdmin,
  requireTenantId,
  serializeMessage,
  supportApiError,
} from '@/lib/support/api'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = assertAnySupportApiKey(request)
  if (authResult instanceof NextResponse) return authResult

  const conversationId = params.id?.trim()
  if (!conversationId) return supportApiError('conversation id is required')

  const tenantId = requireTenantId(request.nextUrl.searchParams.get('tenant_id'))
  if (!tenantId) return supportApiError('tenant_id is required')

  const limit = clampLimit(request.nextUrl.searchParams.get('limit'), 100, 200)
  const before = request.nextUrl.searchParams.get('before')?.trim() || null
  const after = request.nextUrl.searchParams.get('after')?.trim() || null
  if (before && Number.isNaN(Date.parse(before))) {
    return supportApiError('before must be a valid ISO timestamp')
  }
  if (after && Number.isNaN(Date.parse(after))) {
    return supportApiError('after must be a valid ISO timestamp')
  }

  try {
    const admin = getSupportAdmin()
    const { conversation, forbidden } = await getConversationForTenant(
      admin,
      conversationId,
      tenantId
    )
    if (forbidden) return supportApiError('Forbidden', 403)
    if (!conversation) return supportApiError('Conversation not found', 404)

    let query = admin
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (before) query = query.lt('created_at', before)
    if (after) query = query.gt('created_at', after)

    const { data, error } = await query
    if (error) return supportApiError(error.message, 500)

    return NextResponse.json({
      messages: (data ?? []).map((row) =>
        serializeMessage(row as Record<string, unknown>)
      ),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
