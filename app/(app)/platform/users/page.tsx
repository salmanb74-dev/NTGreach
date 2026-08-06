import UsersClient from '@/components/platform/UsersClient'
import { getCachedProfile } from '@/lib/dataCache'
import { fetchPlatformProfiles } from '@/lib/platform/fetch-profiles'
import { hasPlatformOpsAccess, isPlatformOpsAdmin } from '@/lib/roles'
import { redirect } from 'next/navigation'

export default async function PlatformUsersPage() {
  const profile = await getCachedProfile()
  if (!hasPlatformOpsAccess(profile)) redirect('/ops')

  const canEdit = isPlatformOpsAdmin(profile)
  const { users, error } = await fetchPlatformProfiles()

  return (
    <UsersClient
      initialUsers={users}
      canEdit={canEdit}
      loadError={error}
    />
  )
}
