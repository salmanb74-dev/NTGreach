import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  getConversationForTenant,
  getSupportAdmin,
  getSupportApiActorUserId,
  requireTenantId,
  serializeMessage,
  supportApiError,
} from '@/lib/support/api'
import { screenRecordingExpiresAt } from '@/lib/support/media-limits'

const MESSAGE_TYPES = new Set(['text', 'image', 'voice', 'video', 'file'])

export async function POST(request: NextRequest) {
  const authResult = assertAnySupportApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const keyProduct = authResult.product

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return supportApiError('Invalid JSON body')
  }

  const tenantId = requireTenantId(body.tenant_id)
  const conversationId =
    typeof body.conversation_id === 'string' ? body.conversation_id.trim() : ''
  const messageType =
    typeof body.message_type === 'string' ? body.message_type.trim() : ''

  if (!tenantId) return supportApiError('tenant_id is required')
  if (!conversationId) return supportApiError('conversation_id is required')
  if (!MESSAGE_TYPES.has(messageType)) {
    return supportApiError(
      'message_type must be text, image, voice, video, or file'
    )
  }

  const content =
    typeof body.content === 'string' ? body.content.trim() : null
  const fileUrl =
    typeof body.file_url === 'string' ? body.file_url.trim() : null
  const senderDisplayName =
    typeof body.sender_display_name === 'string'
      ? body.sender_display_name.trim() || null
      : null

  if (messageType === 'text') {
    if (!content) return supportApiError('content is required for text messages')
  } else if (!fileUrl) {
    return supportApiError('file_url is required for media messages')
  }

  let expiresAt: string | null = null
  if (typeof body.expires_at === 'string' && body.expires_at.trim()) {
    if (Number.isNaN(Date.parse(body.expires_at))) {
      return supportApiError('expires_at must be a valid ISO timestamp')
    }
    expiresAt = new Date(body.expires_at).toISOString()
  } else if (messageType === 'video') {
    expiresAt = screenRecordingExpiresAt()
  }

  try {
    const admin = getSupportAdmin()
    const { conversation, forbidden } = await getConversationForTenant(
      admin,
      conversationId,
      tenantId,
      keyProduct
    )
    if (forbidden) return supportApiError('Forbidden', 403)
    if (!conversation) return supportApiError('Conversation not found', 404)

    const actorId = getSupportApiActorUserId()

    // Filename for file attachments lives in content; other media keep content null.
    const storedContent =
      messageType === 'text' || messageType === 'file' ? content : null

    const { data, error } = await admin
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: actorId,
        sender_type: 'customer',
        sender_display_name: senderDisplayName,
        message_type: messageType,
        content: storedContent,
        file_url: messageType === 'text' ? null : fileUrl,
        expires_at: expiresAt,
      })
      .select('*')
      .single()

    if (error || !data) {
      return supportApiError(error?.message ?? 'Failed to send message', 500)
    }

    return NextResponse.json(
      { message: serializeMessage(data as Record<string, unknown>) },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
