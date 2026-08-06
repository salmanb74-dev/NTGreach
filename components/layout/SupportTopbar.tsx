'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

const SUPPORT_TITLES: { match: string; title: string }[] = [
  { match: '/calendar', title: 'Roster' },
  { match: '/chats', title: 'Chats' },
  { match: '/activity', title: 'Activity' },
  { match: '/time', title: 'Time Logging' },
  { match: '/reports', title: 'Hours' },
  { match: '/settings', title: 'Settings' },
  { match: '/dashboard', title: 'Dashboard' },
]

interface Props {
  modules: Module[]
  activeModule: Module
}

export default function SupportTopbar({ modules, activeModule }: Props) {
  const pathname = usePathname()
  const title =
    SUPPORT_TITLES.find(t => pathname.includes(t.match))?.title ?? 'Support'

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
