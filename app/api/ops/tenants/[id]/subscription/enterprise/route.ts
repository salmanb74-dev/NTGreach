import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsAccess } from '@/lib/roles'
import {
  clearRestoEnterpriseOffer,
  putRestoEnterpriseOffer,
  isRestoAdminConfigured,
  RestoAdminApiError,
  RestoAdminConfigError,
} from '@/lib/resto-admin/client'
import {
  ENTERPRISE_OFFER_KEYS,
  parseRestoAdminEnv,
  type RestoEnterpriseOfferInput,
} from '@/lib/resto-admin/types'

function notConfigured(env: ReturnType<typeof parseRestoAdminEnv>) {
  return NextResponse.json(
    {
      error:
        env === 'staging'
          ? 'Resto Staging admin API is not configured. Set RESTO_STAGING_BASE_URL and RESTO_STAGING_ADMIN_API_KEY.'
          : 'Resto Production admin API is not configured. Set RESTO_PROD_BASE_URL and RESTO_PROD_ADMIN_API_KEY.',
      code: 'not_configured',
      env,
    },
    { status: 503 }
  )
}

function mapUpstreamError(err: unknown, env: ReturnType<typeof parseRestoAdminEnv>) {
  if (err instanceof RestoAdminConfigError) {
    return NextResponse.json(
      { error: err.message, code: 'not_configured', env },
      { status: 503 }
    )
  }
  if (err instanceof RestoAdminApiError) {
    return NextResponse.json(
      { error: err.message, code: 'upstream_error', env },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    )
  }
  const message = err instanceof Error ? err.message : 'Server error'
  return NextResponse.json({ error: message }, { status: 500 })
}

/**
 * PUT /api/ops/tenants/:id/subscription/enterprise?env=
 * Proxies Nest: PUT /api/v1/admin/tenants/:id/subscription/enterprise
 * Body must include every Enterprise offer key (full replace).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCachedProfile()
  if (!hasOpsAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = (params.id || '').trim()
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 })
  }

  const env = parseRestoAdminEnv(request.nextUrl.searchParams.get('env'))

  if (!isRestoAdminConfigured(env)) {
    return notConfigured(env)
  }

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
    const result = await putRestoEnterpriseOffer(env, tenantId, offer)
    return NextResponse.json({ env, ...result })
  } catch (err) {
    return mapUpstreamError(err, env)
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
  const profile = await getCachedProfile()
  if (!hasOpsAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = (params.id || '').trim()
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 })
  }

  const env = parseRestoAdminEnv(request.nextUrl.searchParams.get('env'))
  if (!isRestoAdminConfigured(env)) {
    return notConfigured(env)
  }

  const sp = request.nextUrl.searchParams
  let force =
    sp.get('force') === 'true' || sp.get('force') === '1'

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
    const result = await clearRestoEnterpriseOffer(env, tenantId, { force })
    return NextResponse.json({ env, ...result })
  } catch (err) {
    return mapUpstreamError(err, env)
  }
}
