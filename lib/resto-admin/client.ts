import type { RestoAdminEnv, RestoTenant } from '@/lib/resto-admin/types'

export class RestoAdminConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RestoAdminConfigError'
  }
}

export class RestoAdminApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RestoAdminApiError'
    this.status = status
  }
}

function envConfig(env: RestoAdminEnv): { baseUrl: string; apiKey: string } | null {
  if (env === 'staging') {
    const baseUrl = process.env.RESTO_STAGING_BASE_URL?.trim()
    const apiKey = process.env.RESTO_STAGING_ADMIN_API_KEY?.trim()
    if (!baseUrl || !apiKey) return null
    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
  }

  const baseUrl = process.env.RESTO_PROD_BASE_URL?.trim()
  const apiKey = process.env.RESTO_PROD_ADMIN_API_KEY?.trim()
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export function isRestoAdminConfigured(env: RestoAdminEnv): boolean {
  return envConfig(env) !== null
}

function normalizeTenant(raw: Record<string, unknown>): RestoTenant | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) return null

  const name =
    typeof raw.name === 'string'
      ? raw.name.trim()
      : typeof raw.tenantName === 'string'
        ? raw.tenantName.trim()
        : ''

  const ownerName =
    typeof raw.ownerName === 'string'
      ? raw.ownerName.trim()
      : typeof raw.owner_name === 'string'
        ? raw.owner_name.trim()
        : null

  const ownerEmail =
    typeof raw.ownerEmail === 'string'
      ? raw.ownerEmail.trim()
      : typeof raw.owner_email === 'string'
        ? raw.owner_email.trim()
        : null

  return {
    id,
    name: name || id,
    ownerName: ownerName || null,
    ownerEmail: ownerEmail || null,
  }
}

/** Nest returns `{ data: [...] }`; also accept a bare array or `{ tenants: [...] }`. */
function extractTenantRows(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.tenants)) return record.tenants
  return null
}

/**
 * Server-only: list tenants from Resto Nest for the given environment.
 * Never import this into client components.
 */
export async function fetchRestoTenants(env: RestoAdminEnv): Promise<RestoTenant[]> {
  const config = envConfig(env)
  if (!config) {
    throw new RestoAdminConfigError(
      env === 'staging'
        ? 'Resto Staging admin API is not configured. Set RESTO_STAGING_BASE_URL and RESTO_STAGING_ADMIN_API_KEY.'
        : 'Resto Production admin API is not configured. Set RESTO_PROD_BASE_URL and RESTO_PROD_ADMIN_API_KEY.'
    )
  }

  const url = `${config.baseUrl}/api/v1/admin/tenants`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': config.apiKey,
      },
      cache: 'no-store',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new RestoAdminApiError(`Could not reach Resto (${env}): ${message}`, 502)
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const fromBody =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null
    throw new RestoAdminApiError(
      fromBody || `Resto admin API returned ${response.status}`,
      response.status
    )
  }

  const rows = extractTenantRows(body)

  if (!rows) {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  return rows
    .map(row =>
      row && typeof row === 'object'
        ? normalizeTenant(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoTenant => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
