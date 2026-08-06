import type {
  RestoAdminEnv,
  RestoApiHit,
  RestoApiHitMetadata,
  RestoLogsPage,
  RestoLogsQuery,
  RestoTenant,
  RestoTenantDeleteResult,
  RestoTenantDeleteSummary,
} from '@/lib/resto-admin/types'

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

function requireConfig(env: RestoAdminEnv) {
  const config = envConfig(env)
  if (!config) {
    throw new RestoAdminConfigError(
      env === 'staging'
        ? 'Resto Staging admin API is not configured. Set RESTO_STAGING_BASE_URL and RESTO_STAGING_ADMIN_API_KEY.'
        : 'Resto Production admin API is not configured. Set RESTO_PROD_BASE_URL and RESTO_PROD_ADMIN_API_KEY.'
    )
  }
  return config
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function nestErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim()
  }

  const message = record.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  if (Array.isArray(message)) {
    const parts = message
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }

  return fallback
}

async function fetchAdminJson(
  env: RestoAdminEnv,
  pathWithQuery: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    /** Override default 15s (deletes can run long). */
    timeoutMs?: number
  } = {}
): Promise<{ status: number; body: unknown }> {
  const config = requireConfig(env)
  const url = `${config.baseUrl}${pathWithQuery}`
  const method = init.method ?? 'GET'
  const timeoutMs = init.timeoutMs ?? 15_000

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': config.apiKey,
  }
  let body: string | undefined
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new RestoAdminApiError(
        `Resto (${env}) timed out after ${Math.round(timeoutMs / 1000)}s — is Nest running at the configured base URL?`,
        504
      )
    }
    const message = err instanceof Error ? err.message : 'Network error'
    throw new RestoAdminApiError(`Could not reach Resto (${env}): ${message}`, 502)
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    throw new RestoAdminApiError(
      nestErrorMessage(parsed, `Resto admin API returned ${response.status}`),
      response.status
    )
  }

  return { status: response.status, body: parsed }
}

function normalizeTenant(raw: Record<string, unknown>): RestoTenant | null {
  const id = asTrimmedString(raw.id)
  if (!id) return null

  const name =
    asTrimmedString(raw.name) ??
    asTrimmedString(raw.tenantName) ??
    id

  const ownerName =
    asTrimmedString(raw.ownerName) ?? asTrimmedString(raw.owner_name)

  const ownerEmail =
    asTrimmedString(raw.ownerEmail) ?? asTrimmedString(raw.owner_email)

  return {
    id,
    name,
    ownerName,
    ownerEmail,
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

function normalizeMetadata(value: unknown): RestoApiHitMetadata {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RestoApiHitMetadata
  }
  return {}
}

/** Nest admin logs = api_hits HTTP traffic (not audit_logs). */
function normalizeApiHit(raw: Record<string, unknown>): RestoApiHit | null {
  const id = asTrimmedString(raw.id)
  const actionType =
    asTrimmedString(raw.actionType) ?? asTrimmedString(raw.action_type)
  const createdAt =
    asTrimmedString(raw.createdAt) ?? asTrimmedString(raw.created_at)

  if (!id || !actionType || !createdAt) return null

  return {
    id,
    tenantId: asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id),
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    branchId: asTrimmedString(raw.branchId) ?? asTrimmedString(raw.branch_id),
    userId: asTrimmedString(raw.userId) ?? asTrimmedString(raw.user_id),
    userName: asTrimmedString(raw.userName) ?? asTrimmedString(raw.user_name),
    userEmail: asTrimmedString(raw.userEmail) ?? asTrimmedString(raw.user_email),
    actionType,
    metadata: normalizeMetadata(raw.metadata),
    createdAt,
  }
}

/**
 * Server-only: list tenants from Resto Nest for the given environment.
 * Never import this into client components.
 */
export async function fetchRestoTenants(env: RestoAdminEnv): Promise<RestoTenant[]> {
  const { body } = await fetchAdminJson(env, '/api/v1/admin/tenants')
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

function clampLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 50
  return Math.min(200, Math.max(1, Math.floor(value)))
}

/**
 * Server-only: list API hits from Resto Nest GET /api/v1/admin/logs.
 * Never import this into client components.
 */
export async function fetchRestoLogs(
  env: RestoAdminEnv,
  query: RestoLogsQuery = {}
): Promise<RestoLogsPage> {
  const params = new URLSearchParams()
  const limit = clampLimit(query.limit)
  params.set('limit', String(limit))

  if (query.tenantId?.trim()) params.set('tenantId', query.tenantId.trim())
  if (query.actionType?.trim()) params.set('actionType', query.actionType.trim())
  if (query.method?.trim()) params.set('method', query.method.trim().toUpperCase())
  if (query.statusCode != null && String(query.statusCode).trim() !== '') {
    params.set('statusCode', String(query.statusCode).trim())
  }
  if (query.from?.trim()) params.set('from', query.from.trim())
  if (query.to?.trim()) params.set('to', query.to.trim())
  if (query.cursor?.trim()) params.set('cursor', query.cursor.trim())

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/logs?${params.toString()}`
  )

  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  const record = body as { data: unknown[]; nextCursor?: unknown }
  const logs = record.data
    .map(row =>
      row && typeof row === 'object'
        ? normalizeApiHit(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoApiHit => Boolean(row))

  const nextCursor =
    typeof record.nextCursor === 'string' && record.nextCursor.trim()
      ? record.nextCursor.trim()
      : null

  return { logs, nextCursor }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function normalizeDeletionSummary(
  raw: Record<string, unknown> | null | undefined
): RestoTenantDeleteSummary | null {
  if (!raw) return null
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    : []
  const steps = Array.isArray(raw.steps)
    ? raw.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []

  return {
    tenantId:
      asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id),
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    tenantEmail:
      asTrimmedString(raw.tenantEmail) ?? asTrimmedString(raw.tenant_email),
    usersDeleted: asNumber(raw.usersDeleted) ?? asNumber(raw.users_deleted),
    authUsersDeleted:
      asNumber(raw.authUsersDeleted) ?? asNumber(raw.auth_users_deleted),
    authUsersFailed:
      asNumber(raw.authUsersFailed) ?? asNumber(raw.auth_users_failed),
    ordersDeleted: asNumber(raw.ordersDeleted) ?? asNumber(raw.orders_deleted),
    branchesDeleted:
      asNumber(raw.branchesDeleted) ?? asNumber(raw.branches_deleted),
    apiHitsDeleted:
      asNumber(raw.apiHitsDeleted) ?? asNumber(raw.api_hits_deleted),
    warnings,
    steps,
  }
}

/**
 * Server-only: hard-delete a Resto tenant via Nest DELETE /api/v1/admin/tenants/:id.
 * Body confirmTenantId must match the path id (Nest safety check).
 * Never import this into client components.
 */
export async function deleteRestoTenant(
  env: RestoAdminEnv,
  tenantId: string
): Promise<RestoTenantDeleteResult> {
  const id = tenantId.trim()
  if (!id) {
    throw new RestoAdminApiError('Missing tenant id', 400)
  }

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      body: { confirmTenantId: id, confirm: true },
      // Full tenant wipe can take a while (api_hits, catalog, auth users)
      timeoutMs: 120_000,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const summaryRaw =
    record.summary && typeof record.summary === 'object'
      ? (record.summary as Record<string, unknown>)
      : null

  return {
    deleted: record.deleted === true || record.deleted === 'true',
    tenantId:
      asTrimmedString(record.tenantId) ??
      asTrimmedString(record.tenant_id) ??
      id,
    tenantName:
      asTrimmedString(record.tenantName) ??
      asTrimmedString(record.tenant_name),
    summary: normalizeDeletionSummary(summaryRaw),
  }
}
