'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './ClockedInDot.module.css'

/** Polls whether the current CS user has an open clock-in. */
export function useClockedIn(): boolean {
  const [clockedIn, setClockedIn] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setClockedIn(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .maybeSingle()

      const roles = (profile?.roles as string[] | null) ?? []
      if (!roles.some(r => r.startsWith('cs_'))) {
        if (!cancelled) setClockedIn(false)
        return
      }

      const { data } = await supabase
        .from('support_time_logs')
        .select('id')
        .eq('agent_id', user.id)
        .is('clock_out', null)
        .limit(1)

      if (!cancelled) setClockedIn((data?.length ?? 0) > 0)
    }

    void check()
    const interval = setInterval(() => void check(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pathname])

  return clockedIn
}

export default function ClockedInDot({ className = '' }: { className?: string }) {
  const clockedIn = useClockedIn()
  if (!clockedIn) return null
  return (
    <span
      className={`${styles.dot} ${className}`.trim()}
      title="You are clocked in"
      aria-label="Clocked in"
    />
  )
}
