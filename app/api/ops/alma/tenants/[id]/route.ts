import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import {
  deleteAlmaTenant,
  isAlmaAdminConfigured,
  AlmaAdminApiError,
  AlmaAdminConfigError,
} from '@/lib/alma-admin/client'
import { parseAlmaAdminEnv } from '@/lib/alma-admin/types'
import { hasOpsProductAccess } from '@/lib/roles'

/**
 * DELETE /api/ops/alma/tenants/:id?env=staging|production
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, 'alma')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = (params.id || '').trim()
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 })
  }

  const env = parseAlmaAdminEnv(request.nextUrl.searchParams.get('env'))

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

  let body: { confirmTenantId?: string } = {}
  try {
    body = (await request.json()) as { confirmTenantId?: string }
  } catch {
    body = {}
  }

  const confirmId = (body.confirmTenantId || '').trim()
  if (!confirmId) {
    return NextResponse.json(
      {
        error:
          'Body must include confirmTenantId equal to the tenant id (safety check)',
      },
      { status: 400 }
    )
  }
  if (confirmId !== tenantId) {
    return NextResponse.json(
      { error: 'confirmTenantId must exactly match the path tenant id' },
      { status: 400 }
    )
  }

  try {
    const result = await deleteAlmaTenant(env, tenantId)
    return NextResponse.json({ env, ...result })
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
