import { cookies } from 'next/headers'
import NotificationBell from './NotificationBell'
import ModuleSelector from './ModuleSelector'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, type Module } from '@/lib/roles'
import styles from './Topbar.module.css'

interface TopbarProps {
  title:         string
  userName?:     string
  modules?:      Module[]
  activeModule?: Module
}

export default async function Topbar({
  title,
  modules: modulesProp,
  activeModule: activeModuleProp,
}: TopbarProps) {
  let modules = modulesProp ?? []
  let activeModule = activeModuleProp

  if (!modules.length || !activeModule) {
    const profile = await getCachedProfile()
    modules = getAccessibleModules(profile)
    const saved = cookies().get('ntg-active-module')?.value as Module | undefined
    activeModule = (
      saved && modules.includes(saved)
        ? saved
        : modules[0]
    )
  }

  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>
        {modules.length > 0 && activeModule && (
          <ModuleSelector modules={modules} activeModule={activeModule} />
        )}
        <NotificationBell />
      </div>
    </header>
  )
}
