import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCachedProfile } from '@/lib/dataCache'
import {
  getAccessibleModules,
  hasOpsAccess,
  hasPlatformOpsAccess,
  type Module,
} from '@/lib/roles'
import OpsTopbar from '@/components/layout/OpsTopbar'
import styles from './ops.module.css'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCachedProfile()
  if (!hasOpsAccess(profile) && !hasPlatformOpsAccess(profile)) {
    redirect('/login')
  }

  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved &&
    modules.includes(saved) &&
    (saved === 'ops' || saved.startsWith('ops_'))
      ? saved
      : modules.includes('ops')
        ? 'ops'
        : modules.find(m => m.startsWith('ops_')) ?? modules[0]
  )!

  return (
    <>
      <OpsTopbar modules={modules} activeModule={activeModule} />
      <div className={styles.content}>{children}</div>
    </>
  )
}
