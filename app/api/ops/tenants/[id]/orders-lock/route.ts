import { NextRequest, NextResponse } from 'next/server'
import {
  fetchRestoOrdersLock,
  putRestoOrdersLock,
} from '@/lib/resto-admin/client'
import {
  forbidUnlessOpsRestoAdmin,
  mapRestoAdminUpstreamError,
  requireOpsTenantProxy,
} from '@/lib/resto-admin/ops-route'

/**
 * GET /api/ops/tenants/:id/orders-lock?env=
 * Proxies Nest: GET /api/v1/admin/tenants/:id/orders-lock
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error

  try {
    const result = await fetchRestoOrdersLock(ctx.env, ctx.tenantId)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapRestoAdminUpstreamError(err, ctx.env)
  }
}

/**
 * PUT /api/ops/tenants/:id/orders-lock?env=
 * Proxies Nest: PUT /api/v1/admin/tenants/:id/orders-lock
 * Body: `{ locked: true, reason?: string }` or `{ locked: false }`
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error
  const denied = forbidUnlessOpsRestoAdmin(ctx.profile)
  if (denied) return denied

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body must be JSON with a boolean locked field' },
      { status: 400 }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be JSON with a boolean locked field' },
      { status: 400 }
    )
  }

  const record = body as Record<string, unknown>
  if (typeof record.locked !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing or invalid locked (boolean required)' },
      { status: 400 }
    )
  }

  const reason =
    typeof record.reason === 'string' ? record.reason : undefined

  try {
    const result = await putRestoOrdersLock(ctx.env, ctx.tenantId, {
      locked: record.locked,
      reason,
    })
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapRestoAdminUpstreamError(err, ctx.env)
  }
}
