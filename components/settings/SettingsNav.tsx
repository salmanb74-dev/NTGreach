'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './SettingsNav.module.css'

type UserRole = 'admin' | 'manager' | 'sales_rep'

interface Props {
  roles: UserRole[]
}

const NAV = [
  { href: '/settings',              label: 'General',            icon: '⚙',  roles: ['admin'] },
  { href: '/settings/users',        label: 'Users & Roles',      icon: '👥', roles: ['admin'] },
  { href: '/settings/enumerations', label: 'Lists & Values',     icon: '📋', roles: ['admin'] },
  { href: '/settings/targets',      label: 'Targets',            icon: '🎯', roles: ['admin', 'manager'] },
  { href: '/settings/contracts',    label: 'Contract Templates', icon: '📄', roles: ['admin', 'manager'] },
]

export default function SettingsNav({ roles }: Props) {
  const pathname = usePathname()

  const visible = NAV.filter(item =>
    item.roles.some(r => roles.includes(r as UserRole))
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
