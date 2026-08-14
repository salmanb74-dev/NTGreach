import { NextRequest, NextResponse } from 'next/server'
import { fetchRestoTenantSubscription } from '@/lib/resto-admin/client'
import {
  mapRestoAdminUpstreamError,
  requireOpsTenantProxy,
} from '@/lib/resto-admin/ops-route'

/**
 * GET /api/ops/tenants/:id/subscription?env=
 * Proxies Nest: GET /api/v1/admin/tenants/:id/subscription
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error

  try {
    const result = await fetchRestoTenantSubscription(ctx.env, ctx.tenantId)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapRestoAdminUpstreamError(err, ctx.env)
  }
}
