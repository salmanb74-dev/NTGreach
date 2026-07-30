import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import {
  assertSupportApiKey,
  getConversationForTenant,
  getSupportApiActorUserId,
  requireTenantId,
  supportApiError,
} from '@/lib/support/api'
import { SUPPORT_FILES_BUCKET } from '@/lib/support/media-limits'

const BUCKET = SUPPORT_FILES_BUCKET

function storagePathFromPublicUrl(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(fileUrl.slice(index + marker.length).split('?')[0])
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function deleteMessageRow(
  admin: ReturnType<typeof getAdmin>,
  message: { id: string; file_url: string | null }
) {
  if (message.file_url) {
    const path = storagePathFromPublicUrl(message.file_url)
    if (!path) {
      return supportApiError('Invalid media URL', 400)
    }

    const { error: storageError } = await admin.storage.from(BUCKET).remove([path])
    if (storageError) {
      return supportApiError(storageError.message, 500)
    }
  }

  const { error: deleteError } = await admin
    .from('support_messages')
    .delete()
    .eq('id', message.id)

  if (deleteError) {
    return supportApiError(deleteError.message, 500)
  }

  return NextResponse.json({ ok: true })
}

/** Session (agent) or x-api-key (Resto customer via Nest). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const hasApiKey = Boolean(request.headers.get('x-api-key'))

  if (hasApiKey) {
    const authError = assertSupportApiKey(request)
    if (authError) return authError

    const tenantId = requireTenantId(request.nextUrl.searchParams.get('tenant_id'))
    if (!tenantId) return supportApiError('tenant_id is required')

    try {
      const admin = getAdmin()
      const actorId = getSupportApiActorUserId()

      const { data: message, error: fetchError } = await admin
        .from('support_messages')
        .select('id, sender_id, file_url, conversation_id')
        .eq('id', params.id)
        .maybeSingle()

      if (fetchError) return supportApiError(fetchError.message, 500)
      if (!message) return NextResponse.json({ ok: true })

      if (message.sender_id !== actorId) {
        return supportApiError('Forbidden', 403)
      }

      const { conversation, forbidden } = await getConversationForTenant(
        admin,
        message.conversation_id,
        tenantId
      )
      if (forbidden) return supportApiError('Forbidden', 403)
      if (!conversation) return supportApiError('Conversation not found', 404)

      return deleteMessageRow(admin, message)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error'
      return supportApiError(message, 500)
    }
  }

  const userClient = createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdmin()

  const { data: message, error: fetchError } = await admin
    .from('support_messages')
    .select('id, sender_id, file_url')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!message) {
    return NextResponse.json({ ok: true })
  }
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return deleteMessageRow(admin, message)
}
