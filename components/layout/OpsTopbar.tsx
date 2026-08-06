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

export default function OpsTopbar({ modules, activeModule }: Props) {
  const pathname = usePathname()

  let title = 'Home'
  if (pathname.includes('/management') || pathname.includes('/tenants')) {
    title = 'Tenants'
  } else if (pathname.includes('/logs')) {
    title = 'Logs'
  } else if (pathname.includes('/users')) {
    title = 'Users'
  } else if (pathname.includes('/subscription')) {
    title = 'Subscription'
  } else if (pathname.includes('/reports')) {
    title = 'Reports'
  }

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
