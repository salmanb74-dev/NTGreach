'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { UserRole, Module } from '@/lib/roles'
import { moduleHref } from '@/lib/modules'
import { useClockedIn } from '@/components/layout/ClockedInDot'
import {
  getSupportUnreadMessageTotal,
  subscribeSupportUnread,
} from '@/lib/support/unreadStore'
import styles from './Sidebar.module.css'

type ItemDef = {
  /** Path after /{module}/ — empty string = module root (home) */
  section: string
  label: string
  svgPath: string
  adminOnly?: boolean
  csAdminOnly?: boolean
  families: Array<'crm' | 'cs' | 'ops_product' | 'ops_platform'>
}

const NAV_DEFS: ItemDef[] = [
  {
    section: 'dashboard',
    label: 'Dashboard',
    svgPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    families: ['crm'],
  },
  {
    section: 'leads',
    label: 'Leads',
    svgPath:
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z m13 10v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    families: ['crm'],
  },
  {
    section: 'pipeline',
    label: 'Pipeline',
    svgPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
    families: ['crm'],
  },
  {
    section: 'reports',
    label: 'Reports',
    svgPath: 'M18 20V10 M12 20V4 M6 20v-6',
    families: ['crm'],
  },
  {
    section: 'activity',
    label: 'Activity',
    svgPath:
      'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    families: ['crm'],
  },
  {
    section: 'settings',
    label: 'Settings',
    svgPath:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.071-3c0-.34-.027-.674-.08-1l2.116-1.65-2-3.464-2.49.998A7.002 7.002 0 0 0 14.5 5.8L14 3h-4l-.5 2.8a7.002 7.002 0 0 0-2.117 1.088L4.893 5.89l-2 3.464L4.99 11c-.053.326-.08.66-.08 1s.027.674.08 1L2.893 14.65l2 3.464 2.49-.998A7.002 7.002 0 0 0 9.5 18.2L10 21h4l.5-2.8a7.002 7.002 0 0 0 2.117-1.088l2.49.998 2-3.464L18.99 13c.053-.326.08-.66.08-1z',
    adminOnly: true,
    families: ['crm'],
  },
  {
    section: 'dashboard',
    label: 'Dashboard',
    svgPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    families: ['cs'],
  },
  {
    section: 'chats',
    label: 'Chats',
    svgPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    families: ['cs'],
  },
  {
    section: 'activity',
    label: 'Activity',
    svgPath:
      'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    families: ['cs'],
  },
  {
    section: 'calendar',
    label: 'Calendar',
    svgPath:
      'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    families: ['cs'],
  },
  {
    section: 'time',
    label: 'Time',
    svgPath: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6v-4l3-3',
    families: ['cs'],
  },
  {
    section: 'reports',
    label: 'Hours',
    svgPath: 'M18 20V10 M12 20V4 M6 20v-6',
    families: ['cs'],
  },
  {
    section: 'settings',
    label: 'Settings',
    svgPath:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.071-3c0-.34-.027-.674-.08-1l2.116-1.65-2-3.464-2.49.998A7.002 7.002 0 0 0 14.5 5.8L14 3h-4l-.5 2.8a7.002 7.002 0 0 0-2.117 1.088L4.893 5.89l-2 3.464L4.99 11c-.053.326-.08.66-.08 1s.027.674.08 1L2.893 14.65l2 3.464 2.49-.998A7.002 7.002 0 0 0 9.5 18.2L10 21h4l.5-2.8a7.002 7.002 0 0 0 2.117-1.088l2.49.998 2-3.464L18.99 13c.053-.326.08-.66.08-1z',
    adminOnly: true,
    families: ['cs'],
  },
  {
    section: '',
    label: 'Home',
    svgPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    families: ['ops_product', 'ops_platform'],
  },
  {
    section: 'management',
    label: 'Tenants',
    svgPath:
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z m13 10v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    families: ['ops_product'],
  },
  {
    section: 'users',
    label: 'Users',
    svgPath:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    families: ['ops_platform'],
  },
]

function familyOf(mod: Module): ItemDef['families'][number] {
  if (mod === 'ops') return 'ops_platform'
  if (mod.startsWith('ops_')) return 'ops_product'
  if (mod.startsWith('cs_')) return 'cs'
  return 'crm'
}

interface Props {
  roles: UserRole[]
  activeModule: Module
}

export default function Sidebar({ roles = [], activeModule }: Props) {
  const pathname = usePathname()
  const isCrmAdmin = roles.includes('crm_admin')
  const isCsAdmin = roles.includes('cs_admin')
  const isAnyAdmin = isCrmAdmin || isCsAdmin
  const clockedIn = useClockedIn()
  const [supportUnread, setSupportUnread] = useState(0)
  const family = familyOf(activeModule)

  useEffect(() => {
    return subscribeSupportUnread(snap =>
      setSupportUnread(getSupportUnreadMessageTotal(snap))
    )
  }, [])

  const visibleItems = NAV_DEFS.filter(item => {
    if (!item.families.includes(family)) return false
    if (item.csAdminOnly && !isCsAdmin) return false
    if (item.adminOnly && !isAnyAdmin) return false
    return true
  })

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.logoMark} aria-label="NTG Reach">NR</div>

      <ul className={styles.navList} role="list">
        {visibleItems.map(item => {
          const href = item.section
            ? moduleHref(activeModule, item.section)
            : moduleHref(activeModule)
          const isHome = !item.section
          const isActive = isHome
            ? pathname === href || pathname === `/${activeModule}`
            : pathname === href || pathname.startsWith(`${href}/`)
          const showClockDot = clockedIn && item.section === 'time' && family === 'cs'
          const showChatBadge =
            supportUnread > 0 && item.section === 'chats' && family === 'cs'

          return (
            <li key={`${family}-${item.section || 'home'}-${item.label}`}>
              <Link
                href={href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={
                  showClockDot
                    ? `${item.label} · Clocked in`
                    : showChatBadge
                      ? `${item.label} · ${supportUnread} unread`
                      : item.label
                }
                aria-label={
                  showClockDot
                    ? `${item.label}, clocked in`
                    : showChatBadge
                      ? `${item.label}, ${supportUnread} unread`
                      : item.label
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={item.svgPath} />
                </svg>
                {showClockDot && (
                  <span className={styles.clockDot} aria-hidden="true" />
                )}
                {showChatBadge && (
                  <span className={styles.chatBadge}>
                    {supportUnread > 9 ? '9+' : supportUnread}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className={styles.bottomSection}>
        <Link
          href={
            family === 'crm'
              ? moduleHref(activeModule, 'profile')
              : '/profile'
          }
          className={`${styles.navItem} ${
            pathname.endsWith('/profile') || pathname === '/profile'
              ? styles.active
              : ''
          }`}
          title="Profile"
          aria-label="Profile"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </Link>
      </div>
    </nav>
  )
}
