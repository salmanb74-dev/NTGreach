import type { OpsNestProduct } from '@/lib/ops/product'
import type { Module } from '@/lib/modules'
import { modulesForProfile } from '@/lib/platform/access-model'

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
  | 'ops_admin'
  | 'ops_user'

export type Product = 'resto' | 'alma'

export const ROLE_LABELS: Record<UserRole, string> = {
  crm_admin:      'CRM Admin',
  crm_manager:    'CRM Manager',
  crm_sales_rep:  'Sales Rep',
  cs_admin:       'CS Admin',
  cs_manager:     'CS Manager',
  cs_support_rep: 'Support Rep',
  ops_admin:      'Ops Admin',
  ops_user:       'Ops User',
}

export const PRODUCT_LABELS: Record<Product, string> = {
  resto: 'Resto',
  alma:  'Alma',
}

/** Roles shown when editing Reach access (grouped in the UI). */
export const EDITABLE_ROLES: {
  value: UserRole
  label: string
  group: string
}[] = [
  { value: 'crm_admin',      label: 'CRM Admin',    group: 'CRM' },
  { value: 'crm_manager',    label: 'CRM Manager',  group: 'CRM' },
  { value: 'crm_sales_rep',  label: 'Sales Rep',    group: 'CRM' },
  { value: 'cs_admin',       label: 'CS Admin',     group: 'Support' },
  { value: 'cs_manager',     label: 'CS Manager',   group: 'Support' },
  { value: 'cs_support_rep', label: 'Support Rep',  group: 'Support' },
  { value: 'ops_admin',      label: 'Admin',        group: 'Ops' },
  { value: 'ops_user',       label: 'User',         group: 'Ops' },
]

export interface UserProfile {
  id:        string
  full_name: string | null
  email:     string
  roles:     UserRole[]
  /** resto/alma brands (legacy) or explicit module keys (crm_resto, ops, …). */
  products:  string[]
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

// ─── Product Ops (Nest tenants: Ops Resto / Ops Alma) ─────────
/** Elevated Nest product ops (delete, subscription writes, cash settings). */
export function isOpsAdmin(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('ops_admin')
}

/** Any product/platform Ops role (admin or user). */
export function hasOpsAccess(profile: UserProfile | null): boolean {
  return isOpsAdmin(profile) || isPlatformOpsUser(profile)
}

/** Can open Ops Resto / Ops Alma (Admin or User with that module). */
export function hasOpsProductAccess(
  profile: UserProfile | null,
  product: OpsNestProduct
): boolean {
  if (!hasOpsAccess(profile)) return false
  const modules = getAccessibleModules(profile)
  return modules.includes(product === 'alma' ? 'ops_alma' : 'ops_resto')
}

/**
 * Full product-ops admin for a Nest product (not Ops User).
 * Required for delete, subscription mutations, lock writes, cash settings.
 */
export function isOpsProductAdmin(
  profile: UserProfile | null,
  product: OpsNestProduct
): boolean {
  if (!isOpsAdmin(profile)) return false
  const modules = getAccessibleModules(profile)
  return modules.includes(product === 'alma' ? 'ops_alma' : 'ops_resto')
}

/** Ops User for a Nest product (cash collect + read-only elsewhere). */
export function isOpsProductUser(
  profile: UserProfile | null,
  product: OpsNestProduct
): boolean {
  return (
    hasOpsProductAccess(profile, product) && !isOpsProductAdmin(profile, product)
  )
}

// ─── Platform Ops (cross-module Users etc.) ───────────────────
export function isPlatformOpsAdmin(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('ops_admin')
}
export function isPlatformOpsUser(profile: UserProfile | null): boolean {
  return !!profile?.roles?.includes('ops_user')
}
/**
 * Can open platform Ops module (Users / Docs).
 * Ops Admin always; Ops User only when the `ops` module is assigned
 * (product-only Ops Users must not inherit platform Ops).
 */
export function hasPlatformOpsAccess(profile: UserProfile | null): boolean {
  if (isPlatformOpsAdmin(profile)) return true
  if (!isPlatformOpsUser(profile)) return false
  return getAccessibleModules(profile).includes('ops')
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
  return modulesForProfile(profile.roles, profile.products)
}
