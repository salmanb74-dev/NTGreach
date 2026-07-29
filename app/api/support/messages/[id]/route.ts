import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'

const BUCKET = 'support-files'

function storagePathFromPublicUrl(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(fileUrl.slice(index + marker.length).split('?')[0])
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userClient = createUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  // Remove Storage first. If this fails, keep the row so deletion can be retried.
  if (message.file_url) {
    const path = storagePathFromPublicUrl(message.file_url)
    if (!path) {
      return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 })
    }

    const { error: storageError } = await admin.storage.from(BUCKET).remove([path])
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }
  }

  const { error: deleteError } = await admin
    .from('support_messages')
    .delete()
    .eq('id', message.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
