import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/dataCache'
import { isPlatformOpsAdmin } from '@/lib/roles'

export default async function OpsSettingsIndexPage() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) redirect('/ops')
  redirect('/ops/settings/enumerations')
}
