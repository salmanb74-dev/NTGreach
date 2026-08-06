import UserDetailClient from '@/components/platform/UserDetailClient'
import { getCachedProfile } from '@/lib/dataCache'
import { fetchPlatformProfileById } from '@/lib/platform/fetch-profiles'
import { hasPlatformOpsAccess, isPlatformOpsAdmin } from '@/lib/roles'
import { notFound, redirect } from 'next/navigation'

export default async function PlatformUserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const profile = await getCachedProfile()
  if (!hasPlatformOpsAccess(profile)) redirect('/ops')

  const canEdit = isPlatformOpsAdmin(profile)
  const { user, error } = await fetchPlatformProfileById(params.id)

  if (error || !user) notFound()

  return (
    <UserDetailClient
      canEdit={canEdit}
      user={user}
      currentUserId={profile?.id ?? null}
    />
  )
}
