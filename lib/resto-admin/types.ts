export type RestoAdminEnv = 'staging' | 'production'

export type RestoTenant = {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
}

export type RestoAdminTenantTab =
  | 'overview'
  | 'reports'
  | 'subscription'
  | 'delete'
  | 'logs'

export function isRestoAdminEnv(value: string | null | undefined): value is RestoAdminEnv {
  return value === 'staging' || value === 'production'
}

export function parseRestoAdminEnv(
  value: string | null | undefined,
  fallback: RestoAdminEnv = 'staging'
): RestoAdminEnv {
  return isRestoAdminEnv(value) ? value : fallback
}
