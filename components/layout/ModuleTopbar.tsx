'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

export type ModuleTopbarTitleRule = { match: string; title: string }

type Props = {
  modules: Module[]
  activeModule: Module
  /** First matching pathname substring wins. */
  titles: ModuleTopbarTitleRule[]
  fallbackTitle: string
}

export default function ModuleTopbar({
  modules,
  activeModule,
  titles,
  fallbackTitle,
}: Props) {
  const pathname = usePathname()
  const title =
    titles.find(t => pathname.includes(t.match))?.title ?? fallbackTitle

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
