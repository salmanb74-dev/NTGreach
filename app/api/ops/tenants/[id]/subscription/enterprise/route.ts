import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsAccess } from '@/lib/roles'
import {
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

  // Pass through — Nest validates fully
  const offer = record as unknown as RestoEnterpriseOfferInput

  try {
    const result = await putRestoEnterpriseOffer(env, tenantId, offer)
    return NextResponse.json({ env, ...result })
  } catch (err) {
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
}
