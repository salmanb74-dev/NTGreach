'use client'

/**
 * Support chat Realtime helpers.
 *
 * Prerequisite (Supabase Dashboard → Database → Replication):
 * enable realtime for `support_messages` and `support_conversations`.
 * Or run: supabase/phase_c_support_realtime.sql
 *
 * For DELETE events to include conversation_id (optional, we also
 * listen without a filter): run phase_c_support_message_delete.sql
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import type { ChatMessage } from '@/components/support/types'

export type SupportMessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  sender_type: 'agent' | 'customer'
  message_type: 'text' | 'image' | 'voice' | 'video'
  content: string | null
  file_url: string | null
  created_at: string
  read_at: string | null
  expires_at?: string | null
}

export function conversationChannelName(conversationId: string) {
  return `support-chat:${conversationId}`
}

export function rowToChatMessage(
  row: SupportMessageRow,
  senderName: string
): ChatMessage {
  return {
    id:              row.id,
    conversation_id: row.conversation_id,
    sender_id:       row.sender_id,
    sender_type:     row.sender_type,
    sender_name:     senderName,
    message_type:    row.message_type,
    content:         row.content,
    file_url:        row.file_url,
    created_at:      row.created_at,
    read_at:         row.read_at,
    expires_at:      row.expires_at ?? null,
  }
}

function readBroadcastPayload<T>(msg: unknown): T | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as { payload?: T }
  if (m.payload !== undefined) return m.payload
  return msg as T
}

/**
 * Subscribe to new/deleted messages for a conversation.
 * Uses postgres_changes + broadcast on a stable topic so Chats +
 * Simulator (separate tabs) stay in sync.
 */
export async function subscribeToConversationMessages(opts: {
  conversationId: string
  onMessage: (row: SupportMessageRow) => void
  onMessageDeleted?: (messageId: string) => void
  onConversationUpdate?: (row: {
    last_message_at?: string | null
    title?: string | null
  }) => void
}): Promise<{ supabase: SupabaseClient; channel: RealtimeChannel }> {
  const supabase = createClient()
  await ensureRealtimeAuth(supabase)

  // Drop a stale channel with the same topic (e.g. React Strict Mode remount)
  const topic = conversationChannelName(opts.conversationId)
  for (const existing of supabase.getChannels()) {
    // topic looks like "realtime:support-chat:<uuid>"
    if (existing.topic === `realtime:${topic}`) {
      supabase.removeChannel(existing)
    }
  }

  const channel = supabase
    .channel(topic, {
      config: { broadcast: { self: false } },
    })
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'support_messages',
        filter: `conversation_id=eq.${opts.conversationId}`,
      },
      (payload) => {
        opts.onMessage(payload.new as SupportMessageRow)
      }
    )
    // DELETE: do NOT filter by conversation_id. Default replica identity
    // only includes the primary key, so filtered DELETE never fires.
    // We remove by message id; if it isn't in this chat's list, no-op.
    .on(
      'postgres_changes',
      {
        event:  'DELETE',
        schema: 'public',
        table:  'support_messages',
      },
      (payload) => {
        const row = payload.old as { id?: string; conversation_id?: string }
        if (!row.id) return
        if (row.conversation_id && row.conversation_id !== opts.conversationId) {
          return
        }
        opts.onMessageDeleted?.(row.id)
      }
    )
    .on('broadcast', { event: 'new_message' }, (msg) => {
      const row = readBroadcastPayload<SupportMessageRow>(msg)
      if (row?.conversation_id === opts.conversationId) {
        opts.onMessage(row)
      }
    })
    .on('broadcast', { event: 'delete_message' }, (msg) => {
      const data = readBroadcastPayload<{ id?: string; conversation_id?: string }>(msg)
      if (data?.id && data.conversation_id === opts.conversationId) {
        opts.onMessageDeleted?.(data.id)
      }
    })

  if (opts.onConversationUpdate) {
    channel.on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'support_conversations',
        filter: `id=eq.${opts.conversationId}`,
      },
      (payload) => {
        opts.onConversationUpdate?.(
          payload.new as { last_message_at?: string | null; title?: string | null }
        )
      }
    )
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), 5000)
    channel.subscribe((status) => {
      if (
        status === 'SUBSCRIBED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })

  return { supabase, channel }
}

/** Notify other tabs/clients of a newly inserted message. */
export async function broadcastNewMessage(
  channel: RealtimeChannel | null,
  row: SupportMessageRow
) {
  if (!channel) return
  const status = await channel.send({
    type:    'broadcast',
    event:   'new_message',
    payload: row,
  })
  if (status !== 'ok') {
    console.warn('[support realtime] new_message broadcast:', status)
  }
}

/** Notify other tabs/clients that a message was deleted. */
export async function broadcastDeleteMessage(
  channel: RealtimeChannel | null,
  opts: { id: string; conversation_id: string }
) {
  if (!channel) return
  const status = await channel.send({
    type:    'broadcast',
    event:   'delete_message',
    payload: opts,
  })
  if (status !== 'ok') {
    console.warn('[support realtime] delete_message broadcast:', status)
  }
}

export type ConversationMetaUpdate = {
  id: string
  title?: string | null
  last_message_at?: string | null
  status?: 'open' | 'closed'
  support_category?: 'platform' | 'operational'
  logged_minutes?: number
}

const META_CHANNEL = 'support-conversations-meta'

type MetaListener = (row: ConversationMetaUpdate) => void

const metaListeners = new Set<MetaListener>()
let metaChannel: RealtimeChannel | null = null
let metaChannelReady: Promise<RealtimeChannel | null> | null = null

async function ensureMetaChannel(): Promise<RealtimeChannel | null> {
  if (typeof window === 'undefined') return null
  if (metaChannel) return metaChannel
  if (metaChannelReady) return metaChannelReady

  metaChannelReady = (async () => {
    const supabase = createClient()
    await ensureRealtimeAuth(supabase)

    for (const existing of supabase.getChannels()) {
      if (existing.topic === `realtime:${META_CHANNEL}`) {
        supabase.removeChannel(existing)
      }
    }

    const channel = supabase
      .channel(META_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'conversation_meta' }, (msg) => {
        const row = readBroadcastPayload<ConversationMetaUpdate>(msg)
        if (!row?.id) return
        for (const listener of metaListeners) listener(row)
      })

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000)
      channel.subscribe((status) => {
        if (
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    metaChannel = channel
    return channel
  })().catch(() => {
    metaChannelReady = null
    return null
  })

  return metaChannelReady
}

/**
 * Cross-tab sync for conversation title / last activity.
 * Complements postgres UPDATE (which can miss or lag).
 */
export function subscribeToConversationMeta(listener: MetaListener) {
  metaListeners.add(listener)
  void ensureMetaChannel()
  return () => {
    metaListeners.delete(listener)
  }
}

/** Notify Chats + Simulator lists of title / activity changes. */
export async function broadcastConversationMeta(row: ConversationMetaUpdate) {
  const channel = await ensureMetaChannel()
  if (!channel) return
  const status = await channel.send({
    type:    'broadcast',
    event:   'conversation_meta',
    payload: row,
  })
  if (status !== 'ok') {
    console.warn('[support realtime] conversation_meta broadcast:', status)
  }
}
