'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import {
  broadcastConversationMeta,
  broadcastNewMessage,
  subscribeToConversationMessages,
  type SupportMessageRow,
} from '@/lib/support/realtime'
import { mapSupportRowToChatMessage } from '@/lib/support/messages'
import type { ChatMessage } from './types'

type Options = {
  conversationId: string | null
  onMessageActivity?: (conversationId: string, at: string) => void
  onTitleUpdate?: (title: string) => void
}

export function useChatMessages({
  conversationId,
  onMessageActivity,
  onTitleUpdate,
}: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameCache = useRef<Record<string, string>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onMessageActivityRef = useRef(onMessageActivity)
  onMessageActivityRef.current = onMessageActivity
  const onTitleUpdateRef = useRef(onTitleUpdate)
  onTitleUpdateRef.current = onTitleUpdate

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      channelRef.current = null
      return
    }

    let cancelled = false
    const supabase = createClient()

    async function resolveSenderName(senderId: string, senderType: string) {
      if (nameCache.current[senderId]) return nameCache.current[senderId]
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', senderId)
        .maybeSingle()
      const name =
        profile?.full_name?.trim() ||
        profile?.email ||
        (senderType === 'customer' ? 'Customer' : 'Unknown')
      nameCache.current[senderId] = name
      return name
    }

    async function handleIncoming(row: SupportMessageRow) {
      const senderName =
        row.sender_display_name?.trim() ||
        (await resolveSenderName(row.sender_id, row.sender_type))
      const msg = mapSupportRowToChatMessage(row, senderName)
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      onMessageActivityRef.current?.(conversationId!, row.created_at)
    }

    async function setup() {
      setLoading(true)
      setError(null)

      await ensureRealtimeAuth(supabase)

      const { data, error: fetchError } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setMessages([])
        setLoading(false)
        return
      }

      const rows = (data ?? []) as SupportMessageRow[]
      const senderIds = [...new Set(rows.map(r => r.sender_id))]
      const missing = senderIds.filter(id => !nameCache.current[id])

      if (missing.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', missing)

        for (const p of profiles ?? []) {
          nameCache.current[p.id] = p.full_name?.trim() || p.email || 'Unknown'
        }
      }

      if (cancelled) return

      setMessages(
        rows.map(r =>
          mapSupportRowToChatMessage(
            r,
            r.sender_display_name?.trim() ||
              nameCache.current[r.sender_id] ||
              'Unknown'
          )
        )
      )
      setLoading(false)

      const { channel } = await subscribeToConversationMessages({
        conversationId: conversationId!,
        onMessage: row => {
          if (!cancelled) void handleIncoming(row)
        },
        onMessageDeleted: messageId => {
          if (!cancelled) {
            setMessages(prev => prev.filter(m => m.id !== messageId))
          }
        },
        onConversationUpdate: row => {
          if (row.last_message_at) {
            onMessageActivityRef.current?.(conversationId!, row.last_message_at)
          }
          if (row.title !== undefined) {
            onTitleUpdateRef.current?.(row.title ?? '')
          }
        },
      })

      if (cancelled) {
        supabase.removeChannel(channel)
        return
      }

      channelRef.current = channel
    }

    void setup()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId])

  function appendLocalMessage(row: SupportMessageRow, senderName: string) {
    onMessageActivityRef.current?.(row.conversation_id, row.created_at)
    setMessages(prev => {
      if (prev.some(m => m.id === row.id)) return prev
      return [...prev, mapSupportRowToChatMessage(row, senderName)]
    })
    void broadcastNewMessage(channelRef.current, row)
    void broadcastConversationMeta({
      id:              row.conversation_id,
      last_message_at: row.created_at,
    })
  }

  function removeMessage(messageId: string) {
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  return {
    messages,
    loading,
    error,
    setError,
    channelRef,
    nameCache,
    appendLocalMessage,
    removeMessage,
  }
}
