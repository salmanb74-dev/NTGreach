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

export const MODULE_LABELS: Record<Module, string> = {
  crm_resto:  'CRM Resto',
  crm_alma:   'CRM Alma',
  cs_resto:   'Support Resto',
  cs_alma:    'Support Alma',
  ops_resto:  'Ops Resto',
  ops_alma:   'Ops Alma',
}

/** Landing path for a module (used by module switcher + post-login redirect). */
export function getModuleHomePath(mod: Module): string {
  if (mod.startsWith('crm_')) return '/dashboard'
  if (mod.startsWith('cs_')) return '/support/dashboard'
  if (mod.startsWith('ops_')) return '/ops'
  return '/dashboard'
}
