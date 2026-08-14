import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsAccess } from '@/lib/roles'
import {
  isRestoAdminConfigured,
  RestoAdminApiError,
  RestoAdminConfigError,
} from '@/lib/resto-admin/client'
import {
  parseRestoAdminEnv,
  type RestoAdminEnv,
} from '@/lib/resto-admin/types'

export function restoAdminNotConfigured(env: RestoAdminEnv) {
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

export function mapRestoAdminUpstreamError(err: unknown, env: RestoAdminEnv) {
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
 * Auth + tenant id + env parsing for ops Nest proxy routes.
 * Returns either a ready context or an error NextResponse.
 */
export async function requireOpsTenantProxy(request: NextRequest, tenantIdRaw: string) {
  const profile = await getCachedProfile()
  if (!hasOpsAccess(profile)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const tenantId = (tenantIdRaw || '').trim()
  if (!tenantId) {
    return {
      error: NextResponse.json({ error: 'Missing tenant id' }, { status: 400 }),
    }
  }

  const env = parseRestoAdminEnv(request.nextUrl.searchParams.get('env'))
  if (!isRestoAdminConfigured(env)) {
    return { error: restoAdminNotConfigured(env) }
  }

  return { profile, tenantId, env }
}
