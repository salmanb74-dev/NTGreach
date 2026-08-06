import { NextRequest, NextResponse } from 'next/server'
import { getCachedProfile } from '@/lib/dataCache'
import { hasOpsAccess } from '@/lib/roles'
import {
  deleteRestoTenant,
  isRestoAdminConfigured,
  RestoAdminApiError,
  RestoAdminConfigError,
} from '@/lib/resto-admin/client'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

/**
 * DELETE /api/ops/tenants/:id?env=staging|production
 * Proxies Nest hard-delete. Body: { confirmTenantId: same as path }.
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
    const result = await deleteRestoTenant(env, tenantId)
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
