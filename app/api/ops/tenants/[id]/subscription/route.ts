import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsAccess } from '@/lib/roles'
import {
  fetchRestoTenantSubscription,
  isRestoAdminConfigured,
  RestoAdminApiError,
  RestoAdminConfigError,
} from '@/lib/resto-admin/client'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

/**
 * GET /api/ops/tenants/:id/subscription?env=
 * Proxies Nest: GET /api/v1/admin/tenants/:id/subscription
 */
export async function GET(
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

  try {
    const result = await fetchRestoTenantSubscription(env, tenantId)
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
