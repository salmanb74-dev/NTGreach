import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Sidebar from '@/components/layout/Sidebar'
import KeepAlive from '@/components/layout/KeepAlive'
import { getUser, getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, hasCrmAccess, type Module } from '@/lib/roles'
import styles from './layout.module.css'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile()
  if (!profile) redirect('/login')

  const accessibleModules = getAccessibleModules(profile)
  if (accessibleModules.length === 0) redirect('/login')

  // Determine active module from cookie (set by ModuleSelector on switch)
  const cookieStore = cookies()
  const savedModule = cookieStore.get('ntg-active-module')?.value as Module | undefined
  const activeModule: Module = (
    savedModule && accessibleModules.includes(savedModule)
      ? savedModule
      : accessibleModules[0]
  )

  return (
    <div className={styles.shell}>
      <KeepAlive />
      <Sidebar
        roles={profile.roles}
        activeModule={activeModule}
      />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
