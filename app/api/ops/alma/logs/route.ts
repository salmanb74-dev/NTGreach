import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import {
  fetchAlmaLogs,
  isAlmaAdminConfigured,
  AlmaAdminApiError,
  AlmaAdminConfigError,
} from '@/lib/alma-admin/client'
import { parseAlmaAdminEnv } from '@/lib/alma-admin/types'
import { hasOpsProductAccess } from '@/lib/roles'

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(request: NextRequest) {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, 'alma')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const env = parseAlmaAdminEnv(params.get('env'))

  if (!isAlmaAdminConfigured(env)) {
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

  try {
    const page = await fetchAlmaLogs(env, {
      tenantId: optionalParam(params.get('tenantId')),
      actionType: optionalParam(params.get('actionType')),
      method: optionalParam(params.get('method')),
      statusCode: optionalParam(params.get('statusCode')),
      from: optionalParam(params.get('from')),
      to: optionalParam(params.get('to')),
      cursor: optionalParam(params.get('cursor')),
      limit: parseLimit(params.get('limit')),
    })
    return NextResponse.json({
      env,
      logs: page.logs,
      nextCursor: page.nextCursor,
    })
  } catch (err) {
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
}
