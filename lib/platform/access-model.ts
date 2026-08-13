import {
  MODULE_LABELS,
  type Module,
  ALL_MODULES,
  ASSIGNABLE_MODULES,
  isModule,
  isAssignableModule,
} from '@/lib/modules'
import type { UserRole } from '@/lib/roles'

/**
 * UI-level capability chips for platform Ops Users matrix.
 * These are NOT stored on profiles — they map to/from UserRole storage keys
 * (crm_sales_rep, crm_admin, cs_*, ops_*). See storageRolesFromMatrix().
 */
export type PlatformRole = 'sales_rep' | 'support_rep' | 'admin' | 'user'

export const PLATFORM_ROLES: {
  value: PlatformRole
  label: string
  hint?: string
}[] = [
  { value: 'sales_rep', label: 'Sales Rep', hint: 'CRM work (leads, pipeline)' },
  { value: 'support_rep', label: 'Support Rep', hint: 'Support conversations' },
  {
    value: 'admin',
    label: 'Admin',
    hint: 'Elevated access in selected modules; can manage users when Ops is selected',
  },
  {
    value: 'user',
    label: 'User',
    hint: 'Platform Ops view-only (Users list)',
  },
]

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  sales_rep: 'Sales Rep',
  support_rep: 'Support Rep',
  admin: 'Admin',
  user: 'User',
}

const ADMIN_STORAGE_ROLES: UserRole[] = [
  'crm_admin',
  'crm_manager',
  'cs_admin',
  'cs_manager',
  'ops_admin',
]

/** True when products[] stores full module keys instead of resto/alma brands. */
export function productsAreModuleList(products: string[] | null | undefined): boolean {
  const list = products ?? []
  return list.some(p => isModule(p))
}

/** Display roles for table/forms from stored role keys. */
export function toPlatformRoles(roles: UserRole[] | null | undefined): PlatformRole[] {
  const r = roles ?? []
  const out: PlatformRole[] = []
  if (r.includes('crm_sales_rep')) out.push('sales_rep')
  if (r.includes('cs_support_rep')) out.push('support_rep')
  if (r.some(role => ADMIN_STORAGE_ROLES.includes(role))) out.push('admin')
  if (r.includes('ops_user') && !r.includes('ops_admin')) out.push('user')
  return out
}

/**
 * Modules granted to a profile.
 * - New format: products holds explicit Module keys, filtered by role capability.
 * - Legacy format: brand products × role families.
 * Alma modules are excluded while product is not live (see ASSIGNABLE_MODULES).
 */
export function modulesForProfile(
  roles: UserRole[] | null | undefined,
  products: string[] | null | undefined
): Module[] {
  const r = roles ?? []
  const p = products ?? []
  let modules: Module[] = []

  if (productsAreModuleList(p)) {
    for (const raw of p) {
      if (!isModule(raw)) continue
      if (raw === 'ops') {
        if (r.includes('ops_admin') || r.includes('ops_user')) modules.push('ops')
      } else if (raw.startsWith('crm_')) {
        if (r.some(x => x.startsWith('crm_'))) modules.push(raw)
      } else if (raw.startsWith('cs_')) {
        if (r.some(x => x.startsWith('cs_'))) modules.push(raw)
      } else if (raw.startsWith('ops_')) {
        if (r.includes('ops_admin')) modules.push(raw)
      }
    }
  } else {
    const brands = p.filter((x): x is 'resto' | 'alma' => x === 'resto' || x === 'alma')
    if (r.includes('ops_admin') || r.includes('ops_user')) modules.push('ops')
    for (const brand of brands) {
      if (r.some(x => x.startsWith('crm_'))) modules.push(`crm_${brand}` as Module)
      if (r.some(x => x.startsWith('cs_'))) modules.push(`cs_${brand}` as Module)
      if (r.includes('ops_admin')) modules.push(`ops_${brand}` as Module)
    }
  }

  return modules.filter(isAssignableModule)
}

export function formatRolesList(roles: UserRole[] | null | undefined): string {
  const list = toPlatformRoles(roles)
  return list.length
    ? list.map(x => PLATFORM_ROLE_LABELS[x]).join(', ')
    : '—'
}

export function formatModulesList(
  roles: UserRole[] | null | undefined,
  products: string[] | null | undefined
): string {
  const list = modulesForProfile(roles, products)
  return list.length ? list.map(m => MODULE_LABELS[m]).join(', ') : '—'
}

/** Roles that apply to a single module, derived from *storage* roles (family-accurate). */
export function platformRolesForModule(
  mod: Module,
  storageRoles: UserRole[] | null | undefined
): PlatformRole[] {
  const r = storageRoles ?? []

  if (mod.startsWith('crm_')) {
    const out: PlatformRole[] = []
    if (r.includes('crm_sales_rep')) out.push('sales_rep')
    if (r.includes('crm_admin') || r.includes('crm_manager')) out.push('admin')
    return out
  }
  if (mod.startsWith('cs_')) {
    const out: PlatformRole[] = []
    if (r.includes('cs_support_rep')) out.push('support_rep')
    if (r.includes('cs_admin') || r.includes('cs_manager')) out.push('admin')
    return out
  }
  if (mod === 'ops_resto' || mod === 'ops_alma') {
    return r.includes('ops_admin') ? ['admin'] : []
  }
  // platform Ops
  if (r.includes('ops_admin')) return ['admin']
  if (r.includes('ops_user')) return ['user']
  return []
}

/** Allowed role checkboxes for a module row in the matrix UI. */
export function allowedRolesForModule(mod: Module): PlatformRole[] {
  if (mod.startsWith('crm_')) return ['sales_rep', 'admin']
  if (mod.startsWith('cs_')) return ['support_rep', 'admin']
  if (mod === 'ops_resto' || mod === 'ops_alma') return ['admin']
  return ['admin', 'user']
}

export type ModuleRoleMap = Record<Module, PlatformRole[]>

export function emptyModuleRoleMap(): ModuleRoleMap {
  return ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = []
    return acc
  }, {} as ModuleRoleMap)
}

/** Default selection when opening Add user. */
export function defaultModuleRoleMap(): ModuleRoleMap {
  const map = emptyModuleRoleMap()
  map.crm_resto = ['sales_rep']
  return map
}

/** Hydrate matrix from stored profile roles/products (assignable modules only). */
export function selectionFromProfile(
  roles: UserRole[] | null | undefined,
  products: string[] | null | undefined
): ModuleRoleMap {
  const map = emptyModuleRoleMap()
  const active = new Set(modulesForProfile(roles, products))
  for (const mod of ASSIGNABLE_MODULES) {
    if (active.has(mod)) {
      map[mod] = platformRolesForModule(mod, roles)
    }
  }
  return map
}

/**
 * Toggle a role on a module row.
 * Ops module: Admin and User are exclusive.
 */
export function toggleModuleRole(
  map: ModuleRoleMap,
  mod: Module,
  role: PlatformRole
): ModuleRoleMap {
  if (!isAssignableModule(mod)) return map
  if (!allowedRolesForModule(mod).includes(role)) return map
  const current = map[mod] ?? []
  const has = current.includes(role)
  let next = has ? current.filter(r => r !== role) : [...current, role]

  if (mod === 'ops') {
    if (!has && role === 'admin') next = ['admin']
    if (!has && role === 'user') next = ['user']
  }

  return { ...map, [mod]: next }
}

export type EncodeAccessResult =
  | { ok: true; roles: UserRole[]; products: Module[] }
  | { ok: false; error: string }

/**
 * Encode per-module matrix → storage roles + explicit modules.
 * Only assignable (live) modules are persisted.
 */
export function encodeModuleRoleMap(map: ModuleRoleMap): EncodeAccessResult {
  const selected: Module[] = []
  let crmLevel: 'none' | 'rep' | 'admin' = 'none'
  let csLevel: 'none' | 'rep' | 'admin' = 'none'
  let opsProduct = false
  let platformOps: 'none' | 'user' | 'admin' = 'none'

  for (const mod of ASSIGNABLE_MODULES) {
    let roles = (map[mod] ?? []).filter(r =>
      allowedRolesForModule(mod).includes(r)
    )
    if (mod === 'ops') {
      if (roles.includes('admin')) roles = ['admin']
      else if (roles.includes('user')) roles = ['user']
      else roles = []
    }
    if (!roles.length) continue

    selected.push(mod)

    if (mod.startsWith('crm_')) {
      if (roles.includes('admin')) crmLevel = 'admin'
      else if (roles.includes('sales_rep') && crmLevel !== 'admin') {
        crmLevel = 'rep'
      }
    } else if (mod.startsWith('cs_')) {
      if (roles.includes('admin')) csLevel = 'admin'
      else if (roles.includes('support_rep') && csLevel !== 'admin') {
        csLevel = 'rep'
      }
    } else if (mod === 'ops_resto') {
      if (roles.includes('admin')) opsProduct = true
    } else if (mod === 'ops') {
      if (roles.includes('admin')) platformOps = 'admin'
      else if (roles.includes('user') && platformOps !== 'admin') {
        platformOps = 'user'
      }
    }
  }

  if (selected.length === 0) {
    return { ok: false, error: 'Select at least one module role' }
  }

  const roles: UserRole[] = []
  if (crmLevel === 'admin') roles.push('crm_admin')
  else if (crmLevel === 'rep') roles.push('crm_sales_rep')

  if (csLevel === 'admin') roles.push('cs_admin')
  else if (csLevel === 'rep') roles.push('cs_support_rep')

  if (opsProduct || platformOps === 'admin') roles.push('ops_admin')
  else if (platformOps === 'user') roles.push('ops_user')

  if (roles.length === 0) {
    return { ok: false, error: 'Could not resolve access roles' }
  }

  return { ok: true, roles, products: selected }
}

export type AccessSegment = {
  module: Module
  moduleLabel: string
  rolesLabel: string
}

/** Structured access segments for rich UI (bold module names). */
export function accessSegmentsForProfile(
  roles: UserRole[] | null | undefined,
  products: string[] | null | undefined
): AccessSegment[] {
  const modules = modulesForProfile(roles, products)
  return modules.map(mod => {
    const applicable = platformRolesForModule(mod, roles)
    return {
      module: mod,
      moduleLabel: MODULE_LABELS[mod],
      rolesLabel: applicable.map(r => PLATFORM_ROLE_LABELS[r]).join(', '),
    }
  })
}

/**
 * Single-column access string (plain text / search):
 * "CRM Resto (Sales Rep), Support Resto (Support Rep), Ops (Admin)"
 */
export function formatAccessByModule(
  roles: UserRole[] | null | undefined,
  products: string[] | null | undefined
): string {
  const segments = accessSegmentsForProfile(roles, products)
  if (!segments.length) return '—'
  return segments
    .map(s =>
      s.rolesLabel ? `${s.moduleLabel} (${s.rolesLabel})` : s.moduleLabel
    )
    .join(', ')
}

/**
 * Map flat roles + modules → storage (legacy helper).
 * Prefer encodeModuleRoleMap for Ops Users matrix.
 */
export function encodeAccess(
  platformRoles: PlatformRole[],
  modules: Module[]
): EncodeAccessResult {
  const roleSet = new Set(platformRoles)
  const selected = ASSIGNABLE_MODULES.filter(m => modules.includes(m))

  if (roleSet.size === 0) {
    return { ok: false, error: 'Select at least one role' }
  }
  if (selected.length === 0) {
    return { ok: false, error: 'Select at least one module' }
  }

  const hasAdmin = roleSet.has('admin')
  const hasUser = roleSet.has('user')
  const hasSales = roleSet.has('sales_rep')
  const hasSupport = roleSet.has('support_rep')

  const wantsCrm = selected.some(m => m.startsWith('crm_'))
  const wantsCs = selected.some(m => m.startsWith('cs_'))
  const wantsOpsProduct = selected.includes('ops_resto')
  const wantsPlatformOps = selected.includes('ops')

  if (wantsCrm && !hasAdmin && !hasSales) {
    return { ok: false, error: 'CRM modules need Sales Rep or Admin' }
  }
  if (wantsCs && !hasAdmin && !hasSupport) {
    return { ok: false, error: 'Support modules need Support Rep or Admin' }
  }
  if (wantsOpsProduct && !hasAdmin) {
    return { ok: false, error: 'Ops Resto requires Admin' }
  }
  if (wantsPlatformOps && !hasAdmin && !hasUser) {
    return { ok: false, error: 'Ops (platform) needs Admin or User' }
  }

  const roles: UserRole[] = []
  if (wantsCrm) roles.push(hasAdmin ? 'crm_admin' : 'crm_sales_rep')
  if (wantsCs) roles.push(hasAdmin ? 'cs_admin' : 'cs_support_rep')
  if (wantsOpsProduct || (wantsPlatformOps && hasAdmin)) {
    roles.push('ops_admin')
  } else if (wantsPlatformOps && hasUser) {
    roles.push('ops_user')
  }

  if (roles.length === 0) {
    return { ok: false, error: 'Roles do not match the selected modules' }
  }

  return { ok: true, roles, products: selected }
}
