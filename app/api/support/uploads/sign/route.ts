import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  getConversationForTenant,
  getSupportAdmin,
  requireTenantId,
  supportApiError,
} from '@/lib/support/api'
import {
  FILE_MAX_BYTES,
  IMAGE_MAX_BYTES,
  SCREEN_MAX_BYTES,
  SUPPORT_FILES_BUCKET,
  VOICE_MAX_BYTES,
  screenRecordingExpiresAt,
} from '@/lib/support/media-limits'

const MEDIA_TYPES = new Set(['image', 'voice', 'video', 'file'])

/**
 * Netlify caps synchronous function request bodies around 6MB, so large screen
 * recordings cannot be POSTed through /api/support/uploads. Nest (or any API
 * client) should:
 *  1) POST JSON here to reserve a path + signed upload URL
 *  2) PUT the file bytes straight to Supabase Storage
 *  3) use the returned file_url when sending the chat message
 */
function maxBytesFor(type: string) {
  if (type === 'voice') return VOICE_MAX_BYTES
  if (type === 'video') return SCREEN_MAX_BYTES
  if (type === 'file') return FILE_MAX_BYTES
  return IMAGE_MAX_BYTES
}

function extensionFor(fileName: string | null, contentType: string, messageType: string) {
  const name = fileName?.toLowerCase() ?? ''
  const match = name.match(/\.([a-z0-9]+)$/)
  if (match) return match[1]

  const mime = contentType.toLowerCase()
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (messageType === 'image') return 'jpg'
  if (messageType === 'voice') return 'webm'
  if (messageType === 'file') return 'bin'
  return 'webm'
}

function folderFor(messageType: string) {
  if (messageType === 'voice') return 'voice'
  if (messageType === 'video') return 'video'
  if (messageType === 'file') return 'files'
  return 'images'
}

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
  const contentType =
    typeof body.content_type === 'string' && body.content_type.trim()
      ? body.content_type.trim()
      : 'application/octet-stream'
  const fileName =
    typeof body.file_name === 'string' && body.file_name.trim()
      ? body.file_name.trim()
      : null
  const byteSize =
    typeof body.byte_size === 'number'
      ? body.byte_size
      : typeof body.byte_size === 'string'
        ? Number.parseInt(body.byte_size, 10)
        : NaN

  if (!tenantId) return supportApiError('tenant_id is required')
  if (!conversationId) return supportApiError('conversation_id is required')
  if (!MEDIA_TYPES.has(messageType)) {
    return supportApiError('message_type must be image, voice, video, or file')
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return supportApiError('byte_size must be a positive number')
  }

  const maxBytes = maxBytesFor(messageType)
  if (byteSize > maxBytes) {
    return supportApiError(
      `file exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`,
      413
    )
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

    const ext = extensionFor(fileName, contentType, messageType)
    const path = `${folderFor(messageType)}/${conversationId}/${Date.now()}.${ext}`

    const { data, error } = await admin.storage
      .from(SUPPORT_FILES_BUCKET)
      .createSignedUploadUrl(path)

    if (error || !data?.signedUrl || !data?.token) {
      return supportApiError(error?.message ?? 'Failed to create signed upload URL', 500)
    }

    const { data: publicData } = admin.storage
      .from(SUPPORT_FILES_BUCKET)
      .getPublicUrl(path)

    const expiresAt = messageType === 'video' ? screenRecordingExpiresAt() : null

    return NextResponse.json(
      {
        path,
        token: data.token,
        signed_url: data.signedUrl,
        file_url: publicData.publicUrl,
        expires_at: expiresAt,
        message_type: messageType,
        content_type: contentType,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
