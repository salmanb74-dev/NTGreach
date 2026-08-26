import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  clampLimit,
  getSupportAdmin,
  getSupportApiActorUserId,
  requireTenantId,
  serializeConversation,
  supportApiError,
} from '@/lib/support/api'

export async function GET(request: NextRequest) {
  const authResult = assertAnySupportApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const keyProduct = authResult.product

  const tenantId = requireTenantId(request.nextUrl.searchParams.get('tenant_id'))
  if (!tenantId) return supportApiError('tenant_id is required')

  const status = request.nextUrl.searchParams.get('status')
  if (status && status !== 'open' && status !== 'closed') {
    return supportApiError('status must be open or closed')
  }

  const branchIdRaw = request.nextUrl.searchParams.get('branch_id')
  const branchId =
    typeof branchIdRaw === 'string' && branchIdRaw.trim()
      ? branchIdRaw.trim()
      : null

  const limit = clampLimit(request.nextUrl.searchParams.get('limit'), 50, 200)

  try {
    const admin = getSupportAdmin()
    let query = admin
      .from('support_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('product', keyProduct)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (branchId) query = query.eq('branch_id', branchId)

    const { data, error } = await query
    if (error) return supportApiError(error.message, 500)

    return NextResponse.json({
      conversations: (data ?? []).map((row) =>
        serializeConversation(row as Record<string, unknown>)
      ),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
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
  const tenantName =
    typeof body.tenant_name === 'string' ? body.tenant_name.trim() : ''
  if (!tenantId) return supportApiError('tenant_id is required')
  if (!tenantName) return supportApiError('tenant_name is required')

  const title =
    body.title === null || body.title === undefined
      ? null
      : typeof body.title === 'string'
        ? body.title.trim() || null
        : null

  // Product is derived from the API key used, not from the request body.
  // This prevents a caller from creating conversations for the wrong product.
  const product = keyProduct

  const branchId =
    typeof body.branch_id === 'string' && body.branch_id.trim()
      ? body.branch_id.trim()
      : null
  const branchName =
    typeof body.branch_name === 'string' && body.branch_name.trim()
      ? body.branch_name.trim().slice(0, 120)
      : null

  try {
    const admin = getSupportAdmin()
    const actorId = getSupportApiActorUserId()

    const { data, error } = await admin
      .from('support_conversations')
      .insert({
        tenant_id: tenantId,
        tenant_name: tenantName,
        title,
        status: 'open',
        created_by: actorId,
        product,
        branch_id: branchId,
        branch_name: branchName,
      })
      .select('*')
      .single()

    if (error || !data) {
      return supportApiError(error?.message ?? 'Failed to create conversation', 500)
    }

    return NextResponse.json(
      { conversation: serializeConversation(data as Record<string, unknown>) },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
