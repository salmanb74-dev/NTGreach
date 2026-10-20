import { NextRequest, NextResponse } from 'next/server'
import {
  clearAlmaEnterpriseOffer,
  putAlmaEnterpriseOffer,
} from '@/lib/alma-admin/client'
import {
  forbidUnlessOpsAlmaAdmin,
  mapAlmaAdminUpstreamError,
  requireOpsAlmaTenantProxy,
} from '@/lib/alma-admin/ops-route'
import {
  ENTERPRISE_OFFER_KEYS,
  type AlmaEnterpriseOfferInput,
} from '@/lib/alma-admin/types'

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
      { error: 'Body must be a JSON object with all required offer fields' },
      { status: 400 }
    )
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be a JSON object with all required offer fields' },
      { status: 400 }
    )
  }

  const record = body as Record<string, unknown>
  const missing = ENTERPRISE_OFFER_KEYS.filter(k => !(k in record))
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required field(s): ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  const offer = record as unknown as AlmaEnterpriseOfferInput

  try {
    const result = await putAlmaEnterpriseOffer(ctx.env, ctx.tenantId, offer)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapAlmaAdminUpstreamError(err, ctx.env)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsAlmaTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error
  const denied = forbidUnlessOpsAlmaAdmin(ctx.profile)
  if (denied) return denied

  const sp = request.nextUrl.searchParams
  let force = sp.get('force') === 'true' || sp.get('force') === '1'

  if (!force) {
    try {
      const text = await request.text()
      if (text.trim()) {
        const parsed = JSON.parse(text) as { force?: unknown }
        if (parsed.force === true || parsed.force === 'true') force = true
      }
    } catch {
      // empty or non-JSON body is fine
    }
  }

  try {
    const result = await clearAlmaEnterpriseOffer(ctx.env, ctx.tenantId, {
      force,
    })
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapAlmaAdminUpstreamError(err, ctx.env)
  }
}
