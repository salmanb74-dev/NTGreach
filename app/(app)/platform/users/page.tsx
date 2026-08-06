import UsersClient from '@/components/platform/UsersClient'
import type { PlatformUserRow } from '@/components/platform/types'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isPlatformOpsAdmin } from '@/lib/roles'
import type { Product, UserRole } from '@/lib/roles'

export default async function PlatformUsersPage() {
  const profile = await getCachedProfile()
  const canEdit = isPlatformOpsAdmin(profile)
  const supabase = createClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles, products, password_changed_at, created_at')
    .order('full_name', { ascending: true })

  const users: PlatformUserRow[] = (data ?? []).map(row => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    roles: (row.roles ?? []) as UserRole[],
    products: (row.products ?? []) as Product[],
    password_changed_at: (row as { password_changed_at?: string | null }).password_changed_at ?? null,
    created_at: (row as { created_at?: string | null }).created_at ?? null,
  }))

  return <UsersClient initialUsers={users} canEdit={canEdit} />
}
