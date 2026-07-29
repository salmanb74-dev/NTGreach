import type { Module } from '@/lib/modules'
export type { Module } from '@/lib/modules'
export { MODULE_LABELS } from '@/lib/modules'

// ─── Role definitions ─────────────────────────────────────────
export type UserRole =
  | 'crm_admin'
  | 'crm_manager'
  | 'crm_sales_rep'
  | 'cs_admin'
  | 'cs_manager'
  | 'cs_support_rep'
  | 'admin_resto'
  | 'admin_alma'

export type Product = 'resto' | 'alma'

export const ROLE_LABELS: Record<UserRole, string> = {
  crm_admin:      'CRM Admin',
  crm_manager:    'CRM Manager',
  crm_sales_rep:  'Sales Rep',
  cs_admin:       'CS Admin',
  cs_manager:     'CS Manager',
  cs_support_rep: 'Support Rep',
  admin_resto:    'Resto Admin',
  admin_alma:     'Alma Admin',
}

export interface UserProfile {
  id:        string
  full_name: string | null
  email:     string
  roles:     UserRole[]
  products:  Product[]
}

// ─── CRM role checks ──────────────────────────────────────────
export function isCrmAdmin(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('crm_admin')
}
export function isCrmManager(profile: UserProfile | null): boolean {
  return !!profile?.roles?.some(r => r === 'crm_admin' || r === 'crm_manager')
}
export function isCrmSalesRep(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('crm_sales_rep')
}
export function hasCrmAccess(profile: UserProfile | null): boolean {
  return !!profile?.roles?.some(r => r.startsWith('crm_'))
}

// ─── CS role checks ───────────────────────────────────────────
export function isCsAdmin(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('cs_admin')
}
export function isCsManager(profile: UserProfile | null): boolean {
  return !!profile?.roles?.some(r => r === 'cs_admin' || r === 'cs_manager')
}
export function isCsSupportRep(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('cs_support_rep')
}
export function hasCsAccess(profile: UserProfile | null): boolean {
  return !!profile?.roles?.some(r => r.startsWith('cs_'))
}

// ─── Admin portal checks ──────────────────────────────────────
export function hasAdminAccess(profile: UserProfile | null): boolean {
  return !!profile?.roles?.some(r => r.startsWith('admin_'))
}

// ─── Generic helpers (backwards compat) ──────────────────────
export function isAdmin(profile: UserProfile | null): boolean {
  return isCrmAdmin(profile) || isCsAdmin(profile)
}
export function isManager(profile: UserProfile | null): boolean {
  return isCrmManager(profile) || isCsManager(profile)
}

// ─── Module access ────────────────────────────────────────────
export function getAccessibleModules(profile: UserProfile | null): Module[] {
  if (!profile) return []
  const roles    = profile.roles    ?? []
  const products = profile.products ?? []
  const modules: Module[] = []

  for (const product of products) {
    if (roles.some(r => r.startsWith('crm_')))              modules.push(`crm_${product}`   as Module)
    if (roles.some(r => r.startsWith('cs_')))               modules.push(`cs_${product}`    as Module)
    if (roles.includes(`admin_${product}` as UserRole))     modules.push(`admin_${product}` as Module)
  }

  return modules
}

// ─── Server helper ────────────────────────────────────────────
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { getCachedProfile } = await import('@/lib/dataCache')
  return getCachedProfile()
}
