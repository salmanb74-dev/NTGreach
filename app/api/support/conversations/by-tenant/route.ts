import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

/**
 * Delete every conversation for a tenant — only when none of them have messages.
 * Used to clean up empty tenant threads from the chats list.
 */
export async function DELETE(request: NextRequest) {
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

  const tenantId = request.nextUrl.searchParams.get('tenant_id')?.trim()
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  const { data: conversations, error: listError } = await admin
    .from('support_conversations')
    .select('id')
    .eq('tenant_id', tenantId)

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const ids = (conversations ?? []).map(c => c.id as string)
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  // Per-conversation existence check (avoid head/count — can ignore filters).
  for (const id of ids) {
    const { data: row, error } = await admin
      .from('support_messages')
      .select('id')
      .eq('conversation_id', id)
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (row) {
      return NextResponse.json(
        {
          error:
            'This tenant has chats with messages. Only empty tenant threads can be removed.',
        },
        { status: 409 }
      )
    }
  }

  const { error: deleteError } = await admin
    .from('support_conversations')
    .delete()
    .eq('tenant_id', tenantId)
    .in('id', ids)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: ids.length })
}
