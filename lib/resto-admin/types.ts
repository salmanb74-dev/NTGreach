export type RestoAdminEnv = 'staging' | 'production'

export type RestoTenant = {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
}

export type RestoAuditLog = {
  id: string
  tenantId: string
  tenantName: string | null
  branchId: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  actionType: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type RestoLogsQuery = {
  tenantId?: string
  actionType?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export type RestoLogsPage = {
  logs: RestoAuditLog[]
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
