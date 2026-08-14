import { NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { SUPPORT_FILES_BUCKET } from '@/lib/support/media-limits'
import { storagePathFromPublicUrl } from '@/lib/support/storage'

const REMOVE_BATCH_SIZE = 100

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userClient = createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getServiceRoleClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const roles = (profile?.roles as string[] | null) ?? []
  if (!roles.some(role => role.startsWith('cs_'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: conversation, error: conversationError } = await admin
    .from('support_conversations')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 })
  }
  if (!conversation) {
    return NextResponse.json({ ok: true })
  }

  const { data: messages, error: messagesError } = await admin
    .from('support_messages')
    .select('file_url')
    .eq('conversation_id', conversation.id)
    .not('file_url', 'is', null)

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 })
  }

  const paths = [
    ...new Set(
      (messages ?? [])
        .map(message =>
          message.file_url ? storagePathFromPublicUrl(message.file_url) : null
        )
        .filter((path): path is string => Boolean(path))
    ),
  ]

  // Remove media before rows so a Storage failure is visible and retryable.
  for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + REMOVE_BATCH_SIZE)
    const { error: storageError } = await admin.storage
      .from(SUPPORT_FILES_BUCKET)
      .remove(batch)

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }
  }

  // support_messages and support_participants cascade from this row.
  const { error: deleteError } = await admin
    .from('support_conversations')
    .delete()
    .eq('id', conversation.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deleted_files: paths.length,
  })
}
