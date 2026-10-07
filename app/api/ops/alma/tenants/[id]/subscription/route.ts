import { NextRequest, NextResponse } from 'next/server'
import { fetchAlmaTenantSubscription } from '@/lib/alma-admin/client'
import {
  mapAlmaAdminUpstreamError,
  requireOpsAlmaTenantProxy,
} from '@/lib/alma-admin/ops-route'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsAlmaTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error

  try {
    const result = await fetchAlmaTenantSubscription(ctx.env, ctx.tenantId)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapAlmaAdminUpstreamError(err, ctx.env)
  }
}
