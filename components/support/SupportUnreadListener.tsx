'use client'

/**
 * Global listener for customer support messages (badge + sound + optional browser notify).
 * Mounted from the app Sidebar so it runs on every authenticated page for CS users.
 */

import { useEffect } from 'react'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import { markSupportCustomerMessage } from '@/lib/support/unreadStore'
import { unlockSupportNotifySound } from '@/lib/support/notifySound'

export default function SupportUnreadListener() {
  useEffect(() => {
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', unlockSupportNotifySound, opts)
    window.addEventListener('keydown', unlockSupportNotifySound, opts)
    return () => {
      window.removeEventListener('pointerdown', unlockSupportNotifySound, opts)
      window.removeEventListener('keydown', unlockSupportNotifySound, opts)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function setup() {
      await ensureRealtimeAuth(supabase)
      if (cancelled) return

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
              content?: string | null
              id?: string
            }
            if (row.sender_type !== 'customer' || !row.conversation_id) return

            const marked = markSupportCustomerMessage(
              row.conversation_id,
              row.id
            )
            if (!marked) return

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
