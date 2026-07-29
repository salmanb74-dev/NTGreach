'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'
import ModuleSelector from '@/components/layout/ModuleSelector'
import ClockedInDot from '@/components/layout/ClockedInDot'
import SupportUnreadListener from '@/components/support/SupportUnreadListener'
import type { Module } from '@/lib/roles'
import styles from '@/components/layout/Topbar.module.css'

const TITLES: { match: string; title: string }[] = [
  { match: '/support/calendar',  title: 'Roster' },
  { match: '/support/chats',     title: 'Chats' },
  { match: '/support/simulator/abbott-pizza', title: 'Abbott Pizza' },
  { match: '/support/simulator/clay-handi',   title: 'Clay Handi' },
  { match: '/support/simulator', title: 'Simulator' },
  { match: '/support/activity',  title: 'Activity' },
  { match: '/support/time',      title: 'Time Logging' },
  { match: '/support/reports',   title: 'Hours' },
  { match: '/support/settings',  title: 'Settings' },
  { match: '/support/dashboard', title: 'Dashboard' },
]

interface Props {
  modules:      Module[]
  activeModule: Module
}

export default function SupportTopbar({ modules, activeModule }: Props) {
  const pathname = usePathname()
  const title =
    TITLES.find(t => pathname.startsWith(t.match))?.title ?? 'Support'

  return (
    <header className={styles.topbar}>
      <SupportUnreadListener />
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.right}>
        {modules.length > 0 && (
          <ModuleSelector modules={modules} activeModule={activeModule} />
        )}
        <span className={styles.clockWrap} title="Clock status">
          <ClockedInDot className={styles.topbarClockDot} />
        </span>
        <NotificationBell />
      </div>
    </header>
  )
}
