'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

const TITLES: { match: string; title: string; exact?: boolean }[] = [
  { match: '/platform/users', title: 'Users' },
  { match: '/platform',       title: 'Home', exact: true },
]

interface Props {
  modules:      Module[]
  activeModule: Module
}

export default function PlatformTopbar({ modules, activeModule }: Props) {
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
