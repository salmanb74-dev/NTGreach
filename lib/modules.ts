// ─── Shared module constants ───────────────────────────────────
// This file is safe to import in both client and server components
// because it has no server-only dependencies.

export type Module =
  | 'crm_resto'
  | 'crm_alma'
  | 'cs_resto'
  | 'cs_alma'
  | 'ops_resto'
  | 'ops_alma'
  | 'ops'

export const ALL_MODULES: Module[] = [
  'crm_resto',
  'crm_alma',
  'cs_resto',
  'cs_alma',
  'ops_resto',
  'ops_alma',
  'ops',
]

/**
 * Modules currently live in the app (module switcher / assignable in Ops Users).
 * Alma is reserved for later — not offered in UI until enabled.
 */
export const ASSIGNABLE_MODULES: Module[] = [
  'crm_resto',
  'cs_resto',
  'ops_resto',
  'ops',
]

export const MODULE_LABELS: Record<Module, string> = {
  crm_resto:  'CRM Resto',
  crm_alma:   'CRM Alma',
  cs_resto:   'Support Resto',
  cs_alma:    'Support Alma',
  ops_resto:  'Ops Resto',
  ops_alma:   'Ops Alma',
  ops:        'Ops',
}

export function isModule(value: string): value is Module {
  return (ALL_MODULES as string[]).includes(value)
}

export function isAssignableModule(value: string): value is Module {
  return (ASSIGNABLE_MODULES as string[]).includes(value)
}

/**
 * Prefer platform Ops, then product Ops (Resto/Alma), then other modules.
 * Used post-login and when falling back from CRM-only routes.
 */
export function pickDefaultModule(modules: Module[]): Module | undefined {
  if (!modules.length) return undefined
  if (modules.includes('ops')) return 'ops'
  const productOps = modules.find(m => m.startsWith('ops_'))
  if (productOps) return productOps
  return modules[0]
}

/**
 * Canonical landing URL for a module: `/{module}` or `/{module}/{section}`.
 * @see lib/module-routing.ts for full path builders
 */
export function getModuleHomePath(mod: Module): string {
  if (mod === 'ops') return '/ops'
  if (mod.startsWith('ops_')) return `/${mod}`
  if (mod.startsWith('crm_')) return `/${mod}/dashboard`
  if (mod.startsWith('cs_')) return `/${mod}/dashboard`
  return `/${mod}`
}

/** Build `/{module}/a/b` safely. */
export function moduleHref(mod: Module, ...segments: string[]): string {
  const rest = segments
    .map(s => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
  return rest.length ? `/${mod}/${rest.join('/')}` : `/${mod}`
}
