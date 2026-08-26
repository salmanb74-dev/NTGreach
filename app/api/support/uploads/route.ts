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

function maxBytesFor(type: string) {
  if (type === 'voice') return VOICE_MAX_BYTES
  if (type === 'video') return SCREEN_MAX_BYTES
  if (type === 'file') return FILE_MAX_BYTES
  return IMAGE_MAX_BYTES
}

function extensionFor(file: File, messageType: string) {
  const name = file.name?.toLowerCase() ?? ''
  const match = name.match(/\.([a-z0-9]+)$/)
  if (match) return match[1]

  const mime = file.type.toLowerCase()
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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return supportApiError('Expected multipart/form-data')
  }

  const tenantId = requireTenantId(form.get('tenant_id'))
  const conversationId =
    typeof form.get('conversation_id') === 'string'
      ? String(form.get('conversation_id')).trim()
      : ''
  const messageType =
    typeof form.get('message_type') === 'string'
      ? String(form.get('message_type')).trim()
      : ''
  const file = form.get('file')

  if (!tenantId) return supportApiError('tenant_id is required')
  if (!conversationId) return supportApiError('conversation_id is required')
  if (!MEDIA_TYPES.has(messageType)) {
    return supportApiError('message_type must be image, voice, video, or file')
  }
  if (!(file instanceof File)) return supportApiError('file is required')
  if (file.size <= 0) return supportApiError('file is empty')

  const maxBytes = maxBytesFor(messageType)
  if (file.size > maxBytes) {
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

    const ext = extensionFor(file, messageType)
    const path = `${folderFor(messageType)}/${conversationId}/${Date.now()}.${ext}`
    const contentType = file.type || 'application/octet-stream'
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from(SUPPORT_FILES_BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      return supportApiError(uploadError.message, 500)
    }

    const { data } = admin.storage.from(SUPPORT_FILES_BUCKET).getPublicUrl(path)
    const expiresAt = messageType === 'video' ? screenRecordingExpiresAt() : null

    return NextResponse.json(
      {
        file_url: data.publicUrl,
        expires_at: expiresAt,
        message_type: messageType,
        file_name: file.name || null,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
