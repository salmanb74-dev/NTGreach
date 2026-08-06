import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCachedProfile } from '@/lib/dataCache'
import {
  getAccessibleModules,
  hasPlatformOpsAccess,
  type Module,
} from '@/lib/roles'
import PlatformTopbar from '@/components/layout/PlatformTopbar'
import styles from './platform.module.css'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCachedProfile()
  if (!hasPlatformOpsAccess(profile)) redirect('/dashboard')

  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved && modules.includes(saved) && saved === 'ops'
      ? saved
      : modules.includes('ops')
        ? 'ops'
        : modules[0]
  )!

  return (
    <>
      <PlatformTopbar modules={modules} activeModule={activeModule} />
      <div className={styles.content}>{children}</div>
    </>
  )
}
