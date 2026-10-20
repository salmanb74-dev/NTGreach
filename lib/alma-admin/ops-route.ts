import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import {
  isAlmaAdminConfigured,
  AlmaAdminApiError,
  AlmaAdminConfigError,
} from '@/lib/alma-admin/client'
import {
  parseAlmaAdminEnv,
  type AlmaAdminEnv,
} from '@/lib/alma-admin/types'
import {
  hasOpsProductAccess,
  isOpsProductAdmin,
  type UserProfile,
} from '@/lib/roles'

export function forbidUnlessOpsAlmaAdmin(profile: UserProfile | null) {
  if (!isOpsProductAdmin(profile, 'alma')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export function almaAdminNotConfigured(env: AlmaAdminEnv) {
  return NextResponse.json(
    {
      error:
        env === 'staging'
          ? 'Alma Staging admin API is not configured. Set ALMA_STAGING_BASE_URL and ALMA_STAGING_ADMIN_API_KEY.'
          : 'Alma Production admin API is not configured. Set ALMA_PROD_BASE_URL and ALMA_PROD_ADMIN_API_KEY.',
      code: 'not_configured',
      env,
    },
    { status: 503 }
  )
}

export function mapAlmaAdminUpstreamError(err: unknown, env: AlmaAdminEnv) {
  if (err instanceof AlmaAdminConfigError) {
    return NextResponse.json(
      { error: err.message, code: 'not_configured', env },
      { status: 503 }
    )
  }
  if (err instanceof AlmaAdminApiError) {
    return NextResponse.json(
      { error: err.message, code: 'upstream_error', env },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    )
  }
  const message = err instanceof Error ? err.message : 'Server error'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function requireOpsAlmaTenantProxy(
  request: NextRequest,
  tenantIdRaw: string
) {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, 'alma')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const tenantId = (tenantIdRaw || '').trim()
  if (!tenantId) {
    return {
      error: NextResponse.json({ error: 'Missing tenant id' }, { status: 400 }),
    }
  }

  const env = parseAlmaAdminEnv(request.nextUrl.searchParams.get('env'))
  if (!isAlmaAdminConfigured(env)) {
    return { error: almaAdminNotConfigured(env) }
  }

  return { profile, tenantId, env }
}

export async function requireOpsAlmaNotesProxy(
  request: NextRequest,
  tenantIdRaw: string
) {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, 'alma')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const tenantId = (tenantIdRaw || '').trim()
  if (!tenantId) {
    return {
      error: NextResponse.json({ error: 'Missing tenant id' }, { status: 400 }),
    }
  }

  const env = parseAlmaAdminEnv(request.nextUrl.searchParams.get('env'))
  return { profile, tenantId, env }
}
