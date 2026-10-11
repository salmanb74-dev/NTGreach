'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './SecondaryNav.module.css'

export interface SecondaryNavItem {
  href:     string
  label:    string
  icon?:    string
  svgPath?: string
}

interface Props {
  title: string
  items: SecondaryNavItem[]
}

const STORAGE_KEY = 'ntg-reach-secondary-nav-collapsed'

export default function SecondaryNav({ title, items }: Props) {
  const pathname  = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggle() {
    setCollapsed(prev => {
      localStorage.setItem(STORAGE_KEY, String(!prev))
      return !prev
    })
  }

  return (
    <nav
      className={`${styles.nav} ${collapsed ? styles.collapsed : ''}`}
      aria-label={title}
    >
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>{title}</span>}
        <button
          className={styles.toggleBtn}
          onClick={toggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={collapsed ? styles.iconFlipped : ''}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <ul className={styles.list} role="list">
        {items.map(item => {
          // Longest matching href wins (nested settings tabs, etc.)
          const bestHref = items
            .filter(candidate => {
              if (pathname === candidate.href) return true
              if (
                candidate.href === '/support/chats' ||
                candidate.href === '/support/dashboard'
              ) {
                return false
              }
              return pathname.startsWith(`${candidate.href}/`)
            })
            .sort((a, b) => b.href.length - a.href.length)[0]?.href
          const isActive = bestHref === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                title={collapsed ? item.label : undefined}
              >
                {item.svgPath ? (
                  <svg
                    className={styles.svgIcon}
                    width="16" height="16"
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
                ) : (
                  <span className={styles.icon}>{item.icon}</span>
                )}
                {!collapsed && <span className={styles.label}>{item.label}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
