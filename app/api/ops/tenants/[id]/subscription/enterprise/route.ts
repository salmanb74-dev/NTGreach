import { NextRequest, NextResponse } from 'next/server'
import {
  clearRestoEnterpriseOffer,
  putRestoEnterpriseOffer,
} from '@/lib/resto-admin/client'
import {
  mapRestoAdminUpstreamError,
  requireOpsTenantProxy,
} from '@/lib/resto-admin/ops-route'
import {
  ENTERPRISE_OFFER_KEYS,
  type RestoEnterpriseOfferInput,
} from '@/lib/resto-admin/types'

/**
 * PUT /api/ops/tenants/:id/subscription/enterprise?env=
 * Proxies Nest: PUT /api/v1/admin/tenants/:id/subscription/enterprise
 * Body must include every Enterprise offer key (full replace).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error

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

  const offer = record as unknown as RestoEnterpriseOfferInput

  try {
    const result = await putRestoEnterpriseOffer(ctx.env, ctx.tenantId, offer)
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapRestoAdminUpstreamError(err, ctx.env)
  }
}

/**
 * DELETE /api/ops/tenants/:id/subscription/enterprise?env=&force=
 * Proxies Nest: DELETE …/subscription/enterprise
 * Cancels pending offer only. force when already on Enterprise / has live terms.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsTenantProxy(request, params.id)
  if ('error' in ctx) return ctx.error

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
    const result = await clearRestoEnterpriseOffer(ctx.env, ctx.tenantId, {
      force,
    })
    return NextResponse.json({ env: ctx.env, ...result })
  } catch (err) {
    return mapRestoAdminUpstreamError(err, ctx.env)
  }
}
