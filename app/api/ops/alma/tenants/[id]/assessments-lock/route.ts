import { NextRequest, NextResponse } from 'next/server'
import {
  fetchAlmaAssessmentsLock,
  putAlmaAssessmentsLock,
} from '@/lib/alma-admin/client'
import {
  forbidUnlessOpsAlmaAdmin,
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
    const result = await fetchAlmaAssessmentsLock(ctx.env, ctx.tenantId)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapAlmaAdminUpstreamError(err, ctx.env)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsAlmaTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error
  const denied = forbidUnlessOpsAlmaAdmin(ctx.profile)
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
    const result = await putAlmaAssessmentsLock(ctx.env, ctx.tenantId, {
      locked: record.locked,
      reason,
    })
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapAlmaAdminUpstreamError(err, ctx.env)
  }
}
