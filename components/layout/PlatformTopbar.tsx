'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

interface Props {
  modules: Module[]
  activeModule: Module
}

/** Platform Ops topbar (Users). Same chrome as product Ops. */
export default function PlatformTopbar({ modules, activeModule }: Props) {
  const pathname = usePathname()
  const title =
    pathname.includes('/users') ? 'Users' : 'Home'

  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>
        {modules.length > 0 && (
          <ModuleSelector modules={modules} activeModule={activeModule} />
        )}
        <NotificationBell />
      </div>
    </header>
  )
}
