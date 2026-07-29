'use client'

/**
 * Global listener for customer support messages (badge + optional browser notify).
 * Mounted on Support topbar so it runs on all support pages.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import { markSupportCustomerMessage } from '@/lib/support/unreadStore'

export default function SupportUnreadListener() {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastSoundAtRef = useRef(0)

  function playNotifySound() {
    const now = Date.now()
    // Prevent rapid beeps when multiple messages arrive quickly.
    if (now - lastSoundAtRef.current < 1500) return
    lastSoundAtRef.current = now

    if (typeof window === 'undefined') return
    try {
      let audio = audioRef.current
      if (!audio) {
        audio = new Audio('/sounds/support-notify.wav')
        audio.preload = 'auto'
        // Clear and present, but not piercing.
        audio.volume = 0.75
        audioRef.current = audio
      }

      audio.currentTime = 0
      void audio.play().catch(() => {
        // Autoplay restrictions can block sound until user interacts once.
      })
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    let currentUserId: string | null = null

    async function setup() {
      await ensureRealtimeAuth(supabase)
      if (cancelled) return

      const { data: { user } } = await supabase.auth.getUser()
      currentUserId = user?.id ?? null

      channel = supabase
        .channel('support-unread-global')
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'support_messages',
          },
          (payload) => {
            const row = payload.new as {
              conversation_id?: string
              sender_type?: string
              sender_id?: string
              content?: string | null
            }
            if (row.sender_type !== 'customer' || !row.conversation_id) return

            // Same tab: you sent this from the customer simulator — do not badge this tab.
            if (
              currentUserId &&
              row.sender_id === currentUserId &&
              pathnameRef.current.startsWith('/support/simulator')
            ) {
              return
            }

            markSupportCustomerMessage(row.conversation_id)

            // Soft ding only when this tab is in the background (not visible).
            if (typeof document !== 'undefined' && document.hidden) {
              playNotifySound()
            }

            if (
              typeof document !== 'undefined' &&
              document.hidden &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification('New support message', {
                  body: row.content?.trim() || 'Customer sent a message',
                  tag:  `support-${row.conversation_id}`,
                })
              } catch {
                // ignore notification errors
              }
            }
          }
        )
        .subscribe()

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission()
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return null
}
