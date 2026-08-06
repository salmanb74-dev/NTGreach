import type { UserRole } from '@/lib/roles'

export type PlatformUserRow = {
  id: string
  full_name: string | null
  email: string
  roles: UserRole[]
  /** resto/alma (legacy) or explicit modules (crm_resto, ops, …) */
  products: string[]
  password_changed_at: string | null
  created_at: string | null
  updated_at: string | null
}
