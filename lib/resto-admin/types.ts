export type RestoAdminEnv = 'staging' | 'production'

export type RestoTenant = {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
}

/** One HTTP request row from Nest `api_hits` (admin logs API). */
export type RestoApiHit = {
  id: string
  tenantId: string | null
  tenantName: string | null
  branchId: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  /** e.g. "GET /api/v1/orders" */
  actionType: string
  metadata: RestoApiHitMetadata
  createdAt: string
}

/** Known keys on api_hits metadata; extra keys allowed. */
export type RestoApiHitMetadata = {
  method?: string
  url?: string
  statusCode?: number
  responseTimeMs?: number
  requestBody?: unknown
  responseBody?: unknown
  [key: string]: unknown
}

/** @deprecated Prefer RestoApiHit — same shape for Reach consumers. */
export type RestoAuditLog = RestoApiHit

export type RestoLogsQuery = {
  tenantId?: string
  /** Method or URL substring match (Nest-side). */
  actionType?: string
  method?: string
  statusCode?: number | string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export type RestoLogsPage = {
  logs: RestoApiHit[]
  nextCursor: string | null
}

export type RestoAdminTenantTab =
  | 'overview'
  | 'reports'
  | 'subscription'
  | 'delete'
  | 'logs'

const TENANT_TABS: ReadonlySet<RestoAdminTenantTab> = new Set([
  'overview',
  'reports',
  'subscription',
  'delete',
  'logs',
])

export function isRestoAdminTenantTab(
  value: string | null | undefined
): value is RestoAdminTenantTab {
  return typeof value === 'string' && TENANT_TABS.has(value as RestoAdminTenantTab)
}

export function parseTenantTab(
  value: string | null | undefined
): RestoAdminTenantTab {
  return isRestoAdminTenantTab(value) ? value : 'overview'
}

export function isRestoAdminEnv(value: string | null | undefined): value is RestoAdminEnv {
  return value === 'staging' || value === 'production'
}

export function parseRestoAdminEnv(
  value: string | null | undefined,
  fallback: RestoAdminEnv = 'staging'
): RestoAdminEnv {
  return isRestoAdminEnv(value) ? value : fallback
}

export function metaString(
  meta: RestoApiHitMetadata,
  key: string
): string | null {
  const v = meta[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

export function metaNumber(
  meta: RestoApiHitMetadata,
  key: string
): number | null {
  const v = meta[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}
