'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/lib/roles'
import styles from './SettingsNav.module.css'

interface Props {
  roles: UserRole[]
}

const NAV: { href: string; label: string; icon: string; roles: UserRole[] }[] = [
  { href: '/settings',              label: 'General',            icon: '⚙',  roles: ['crm_admin'] },
  { href: '/settings/users',        label: 'Users & Roles',      icon: '👥', roles: ['crm_admin'] },
  { href: '/settings/enumerations', label: 'Lists & Values',     icon: '📋', roles: ['crm_admin'] },
  { href: '/settings/targets',      label: 'Targets',            icon: '🎯', roles: ['crm_admin', 'crm_manager'] },
  { href: '/settings/contracts',    label: 'Contract Templates', icon: '📄', roles: ['crm_admin', 'crm_manager'] },
]

export default function SettingsNav({ roles }: Props) {
  const pathname = usePathname()

  const visible = NAV.filter(item =>
    item.roles.some(r => roles.includes(r))
  )

  return (
    <nav className={styles.nav}>
      <div className={styles.title}>Settings</div>
      {visible.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.item} ${pathname === item.href ? styles.active : ''}`}
        >
          <span className={styles.icon}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
