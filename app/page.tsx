import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCachedProfile, getUser } from '@/lib/dataCache'
import { getModuleHomePath, pickDefaultModule, type Module } from '@/lib/modules'
import { getAccessibleModules } from '@/lib/roles'

export default async function RootPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile()
  if (!profile) redirect('/login')

  const accessible = getAccessibleModules(profile)
  if (accessible.length === 0) redirect('/login')

  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const active =
    saved && accessible.includes(saved)
      ? saved
      : pickDefaultModule(accessible)!

  redirect(getModuleHomePath(active))
}
