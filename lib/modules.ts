// ─── Shared module constants ───────────────────────────────────
// This file is safe to import in both client and server components
// because it has no server-only dependencies.

export type Module =
  | 'crm_resto'
  | 'crm_alma'
  | 'cs_resto'
  | 'cs_alma'
  | 'admin_resto'
  | 'admin_alma'

export const MODULE_LABELS: Record<Module, string> = {
  crm_resto:   'CRM Resto',
  crm_alma:    'CRM Alma',
  cs_resto:    'Support Resto',
  cs_alma:     'Support Alma',
  admin_resto: 'Admin Resto',
  admin_alma:  'Admin Alma',
}
