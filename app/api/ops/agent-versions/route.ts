import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsProductAccess } from '@/lib/roles'
import {
  fetchRestoAgentVersions,
  isRestoAdminConfigured,
  RestoAdminApiError,
  RestoAdminConfigError,
} from '@/lib/resto-admin/client'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export async function GET(request: NextRequest) {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, 'resto')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const env = parseRestoAdminEnv(params.get('env'))

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
    const result = await fetchRestoAgentVersions(env, {
      tenantId: optionalParam(params.get('tenantId')),
      q: optionalParam(params.get('q')),
    })
    return NextResponse.json({
      env,
      lanTerminals: result.lanTerminals,
      printDevices: result.printDevices,
    })
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
