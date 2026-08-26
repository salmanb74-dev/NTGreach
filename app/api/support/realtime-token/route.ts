import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  getConversationForTenant,
  getSupportAdmin,
  getSupportApiActorUserId,
  requireTenantId,
  supportApiError,
} from '@/lib/support/api'
import {
  createSupportRealtimeToken,
  SUPPORT_REALTIME_REFRESH_AFTER_SECONDS,
} from '@/lib/support/realtime-token'

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

  if (!tenantId) return supportApiError('tenant_id is required')
  if (!conversationId) return supportApiError('conversation_id is required')

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

    const token = createSupportRealtimeToken({
      tenantId,
      conversationId,
      subject: getSupportApiActorUserId(),
    })

    // Safe deployment fallback while SUPABASE_JWT_SECRET / RLS is being set up.
    if (!token) {
      return NextResponse.json({
        mode: 'poll',
        poll_interval_ms: 3000,
        message:
          'Scoped Realtime JWT is not configured; poll GET /api/support/conversations/{id}/messages',
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return supportApiError('Supabase public env is not configured', 500)
    }

    return NextResponse.json({
      mode: 'realtime',
      access_token: token.accessToken,
      expires_at: token.expiresAt,
      supabase_url: supabaseUrl,
      // Public project bootstrap key only. The scoped JWT enforces authorization.
      supabase_anon_key: supabaseAnonKey,
      refresh_after_seconds: SUPPORT_REALTIME_REFRESH_AFTER_SECONDS,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
