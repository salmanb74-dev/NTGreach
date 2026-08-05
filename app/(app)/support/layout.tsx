import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, hasCsAccess, type Module } from '@/lib/roles'
import SupportTopbar from '@/components/layout/SupportTopbar'
import styles from './support.module.css'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCachedProfile()
  if (!hasCsAccess(profile)) redirect('/dashboard')

  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? modules[0]
  )!

  return (
    <>
      <SupportTopbar
        modules={modules}
        activeModule={activeModule}
      />
      <div className={styles.content}>{children}</div>
    </>
  )
}
