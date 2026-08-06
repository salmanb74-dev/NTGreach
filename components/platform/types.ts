import type { Product, UserRole } from '@/lib/roles'

export type PlatformUserRow = {
  id: string
  full_name: string | null
  email: string
  roles: UserRole[]
  products: Product[]
  password_changed_at: string | null
  created_at: string | null
}
