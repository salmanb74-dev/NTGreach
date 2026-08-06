import UserDetailClient from '@/components/platform/UserDetailClient'
import type { PlatformUserRow } from '@/components/platform/types'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isPlatformOpsAdmin } from '@/lib/roles'
import type { Product, UserRole } from '@/lib/roles'
import { notFound } from 'next/navigation'

export default async function PlatformUserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const profile = await getCachedProfile()
  const canEdit = isPlatformOpsAdmin(profile)
  const supabase = createClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles, products, password_changed_at, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  const user: PlatformUserRow = {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    roles: (data.roles ?? []) as UserRole[],
    products: (data.products ?? []) as Product[],
    password_changed_at:
      (data as { password_changed_at?: string | null }).password_changed_at ?? null,
    created_at: (data as { created_at?: string | null }).created_at ?? null,
  }

  return <UserDetailClient canEdit={canEdit} user={user} />
}
