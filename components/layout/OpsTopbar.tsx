'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

const TITLES: { match: string; title: string; exact?: boolean }[] = [
  { match: '/ops/management',  title: 'Management' },
  { match: '/ops/reports',     title: 'Reports' },
  { match: '/ops/logs',        title: 'Logs' },
  { match: '/ops/subscription', title: 'Subscription' },
  { match: '/ops',             title: 'Home', exact: true },
]

interface Props {
  modules:      Module[]
  activeModule: Module
}

export default function OpsTopbar({ modules, activeModule }: Props) {
  const pathname = usePathname()
  const title =
    TITLES.find(t =>
      t.exact ? pathname === t.match : pathname.startsWith(t.match)
    )?.title ?? 'Ops'

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
