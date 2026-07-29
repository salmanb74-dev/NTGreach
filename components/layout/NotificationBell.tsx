'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  getSupportUnreadMessageTotal,
  subscribeSupportUnread,
} from '@/lib/support/unreadStore'
import styles from './NotificationBell.module.css'

export default function NotificationBell() {
  const [reminderCount, setReminderCount] = useState(0)
  const [supportUnread, setSupportUnread] = useState(0)
  const [onDuty, setOnDuty] = useState(false)
  const pathname = usePathname()

  async function fetchDueCount() {
    const supabase = createClient()
    const { count: dueCount } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .lte('remind_at', new Date().toISOString())
      .is('dismissed_at', null)
    setReminderCount(dueCount ?? 0)
  }

  async function fetchOnDuty() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setOnDuty(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .maybeSingle()

    const roles = (profile?.roles as string[] | null) ?? []
    if (!roles.some(r => r.startsWith('cs_'))) {
      setOnDuty(false)
      return
    }

    const now = new Date().toISOString()
    const { data } = await supabase
      .from('support_shifts')
      .select('id')
      .eq('agent_id', user.id)
      .lte('start_at', now)
      .gte('end_at', now)
      .limit(1)

    setOnDuty((data?.length ?? 0) > 0)
  }

  useEffect(() => {
    return subscribeSupportUnread(snap =>
      setSupportUnread(getSupportUnreadMessageTotal(snap))
    )
  }, [])

  useEffect(() => {
    fetchDueCount()
    fetchOnDuty()
  }, [pathname])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDueCount()
      fetchOnDuty()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const hideSupportBadge = pathname.startsWith('/support/simulator')
  const visibleSupportUnread = hideSupportBadge ? 0 : supportUnread
  const total = reminderCount + visibleSupportUnread
  const titleParts = [
    onDuty ? 'On duty' : null,
    visibleSupportUnread > 0
      ? `${visibleSupportUnread} new support message${visibleSupportUnread === 1 ? '' : 's'}`
      : null,
    reminderCount > 0 ? `${reminderCount} reminder${reminderCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <Link
      href={visibleSupportUnread > 0 ? '/support/chats' : '/notifications'}
      className={styles.bell}
      title={titleParts.length ? titleParts.join(' · ') : 'Notifications'}
    >
      <svg
        width="18" height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {onDuty && (
        <span className={styles.onDutyDot} aria-label="On duty" title="On duty" />
      )}
      {total > 0 && (
        <span className={styles.badge}>{total > 9 ? '9+' : total}</span>
      )}
    </Link>
  )
}
