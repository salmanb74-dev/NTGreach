'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import {
  broadcastConversationMeta,
  broadcastDeleteMessage,
  broadcastNewMessage,
  subscribeToConversationMessages,
  type SupportMessageRow,
} from '@/lib/support/realtime'
import { deleteSupportMessage } from '@/lib/support/upload'
import Button from '@/components/ui/Button'
import ConfirmModal from '@/components/modals/ConfirmModal'
import ImageUploader from './ImageUploader'
import MessageBody from './MessageBody'
import ScreenshotCapture from './ScreenshotCapture'
import ScreenRecorder from './ScreenRecorder'
import VoiceRecorder from './VoiceRecorder'
import type { ChatMessage, ConversationItem, SupportCategory } from './types'
import {
  SUPPORT_CATEGORY_LABELS,
  formatLoggedMinutes,
  snapMinutes,
} from './types'
import { getSupportCoverageState } from '@/lib/actions/support-shifts'
import styles from './ChatWindow.module.css'

interface Props {
  conversation:     ConversationItem | null
  currentUserId:    string
  currentUserName:  string
  onTitleChange:    (id: string, title: string | null) => void
  onConversationPatch?: (
    id: string,
    patch: Partial<Pick<ConversationItem, 'support_category' | 'logged_minutes' | 'title'>>
  ) => void
  onDelete?:        (id: string) => void
  onOpenList?:      () => void
  onMessageActivity?: (conversationId: string, at: string) => void
  deleting?:        boolean
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatWindow({
  conversation,
  currentUserId,
  currentUserName,
  onTitleChange,
  onConversationPatch,
  onDelete,
  onOpenList,
  onMessageActivity,
  deleting = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voiceActive, setVoiceActive] = useState(false)
  const [imageActive, setImageActive] = useState(false)
  const [shotActive, setShotActive] = useState(false)
  const [recActive, setRecActive] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nameCache = useRef<Record<string, string>>({})
  const onMessageActivityRef = useRef(onMessageActivity)
  onMessageActivityRef.current = onMessageActivity
  const channelRef = useRef<RealtimeChannel | null>(null)
  const mediaActive = voiceActive || imageActive || shotActive || recActive

  useEffect(() => {
    if (!conversation) {
      setMessages([])
      channelRef.current = null
      return
    }

    let cancelled = false
    const supabase = createClient()
    const conversationId = conversation.id
    const initialTitle = conversation.title ?? ''

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
      const senderName = await resolveSenderName(row.sender_id, row.sender_type)
      const msg: ChatMessage = {
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
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      onMessageActivityRef.current?.(conversationId, row.created_at)
    }

    async function setup() {
      setLoading(true)
      setError(null)
      setDraft('')
      setVoiceActive(false)
      setImageActive(false)
      setEditingTitle(false)
      setTitleDraft(initialTitle)

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
        rows.map(r => ({
          id:              r.id,
          conversation_id: r.conversation_id,
          sender_id:       r.sender_id,
          sender_type:     r.sender_type,
          sender_name:     nameCache.current[r.sender_id] ?? 'Unknown',
          message_type:    r.message_type,
          content:         r.content,
          file_url:        r.file_url,
          created_at:      r.created_at,
          read_at:         r.read_at,
          expires_at:      r.expires_at ?? null,
        }))
      )
      setLoading(false)

      // Realtime: enable support_messages + support_conversations in Database → Replication
      const { channel } = await subscribeToConversationMessages({
        conversationId,
        onMessage: (row) => {
          if (!cancelled) void handleIncoming(row)
        },
        onMessageDeleted: (messageId) => {
          if (!cancelled) {
            setMessages(prev => prev.filter(m => m.id !== messageId))
          }
        },
        onConversationUpdate: (row) => {
          if (row.last_message_at) {
            onMessageActivityRef.current?.(conversationId, row.last_message_at)
          }
          if (row.title !== undefined) {
            setTitleDraft(row.title ?? '')
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
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Offline hours — show banner when no shift covers "now"
  useEffect(() => {
    let cancelled = false

    async function loadCoverage() {
      try {
        const state = await getSupportCoverageState()
        if (cancelled) return
        setOfflineMessage(state.onDuty ? null : state.offlineMessage)
      } catch {
        if (!cancelled) setOfflineMessage(null)
      }
    }

    void loadCoverage()
    const interval = setInterval(() => void loadCoverage(), 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!conversation || !draft.trim() || sending) return

    setSending(true)
    setError(null)
    const content = draft.trim()
    const supabase = createClient()

    const { data, error: insertError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id:       currentUserId,
        sender_type:     'agent',
        message_type:    'text',
        content,
      })
      .select('*')
      .single()

    setSending(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to send message')
      return
    }

    const row = data as SupportMessageRow
    nameCache.current[currentUserId] = currentUserName
    setDraft('')
    onMessageActivity?.(conversation.id, row.created_at)
    setMessages(prev => {
      if (prev.some(m => m.id === row.id)) return prev
      return [
        ...prev,
        {
          id:              row.id,
          conversation_id: row.conversation_id,
          sender_id:       row.sender_id,
          sender_type:     row.sender_type,
          sender_name:     currentUserName,
          message_type:    row.message_type,
          content:         row.content,
          file_url:        row.file_url,
          created_at:      row.created_at,
          read_at:         row.read_at,
          expires_at:      row.expires_at ?? null,
        },
      ]
    })
    await broadcastNewMessage(channelRef.current, row)
    void broadcastConversationMeta({
      id:              conversation.id,
      last_message_at: row.created_at,
    })
  }

  function appendLocalMessage(row: SupportMessageRow, senderName: string) {
    onMessageActivity?.(row.conversation_id, row.created_at)
    setMessages(prev => {
      if (prev.some(m => m.id === row.id)) return prev
      return [
        ...prev,
        {
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
        },
      ]
    })
    void broadcastNewMessage(channelRef.current, row)
    void broadcastConversationMeta({
      id:              row.conversation_id,
      last_message_at: row.created_at,
    })
  }

  async function confirmDeleteMessage() {
    if (!pendingDelete || deletingMsg) return
    setDeletingMsg(true)
    setError(null)

    const result = await deleteSupportMessage({ id: pendingDelete.id })

    if (result.error) {
      setError(result.error)
      setDeletingMsg(false)
      return
    }

    setMessages(prev => prev.filter(m => m.id !== pendingDelete.id))
    await broadcastDeleteMessage(channelRef.current, {
      id:              pendingDelete.id,
      conversation_id: pendingDelete.conversation_id,
    })
    setPendingDelete(null)
    setDeletingMsg(false)
  }

  async function commitTitle() {
    if (!conversation) return
    const next = titleDraft.trim()
    const prev = (conversation.title ?? '').trim()
    setEditingTitle(false)

    if (next === prev) {
      setTitleDraft(conversation.title ?? '')
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({ title: next || null })
      .eq('id', conversation.id)

    if (updateError) {
      setError(updateError.message)
      setTitleDraft(conversation.title ?? '')
      return
    }

    onTitleChange(conversation.id, next || null)
    onConversationPatch?.(conversation.id, { title: next || null })
    void broadcastConversationMeta({
      id:    conversation.id,
      title: next || null,
    })
  }

  async function saveConversationMeta(patch: {
    support_category?: SupportCategory
    logged_minutes?: number
  }) {
    if (!conversation || savingMeta) return

    const nextCategory = patch.support_category ?? conversation.support_category
    const nextMinutes = snapMinutes(
      patch.logged_minutes ?? conversation.logged_minutes
    )

    if (
      nextCategory === conversation.support_category &&
      nextMinutes === conversation.logged_minutes
    ) {
      return
    }

    setSavingMeta(true)
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({
        support_category: nextCategory,
        logged_minutes:   nextMinutes,
      })
      .eq('id', conversation.id)

    setSavingMeta(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onConversationPatch?.(conversation.id, {
      support_category: nextCategory,
      logged_minutes:   nextMinutes,
    })
    void broadcastConversationMeta({
      id:               conversation.id,
      support_category: nextCategory,
      logged_minutes:   nextMinutes,
    })
  }

  if (!conversation) {
    return (
      <div className={styles.window}>
        <header className={styles.header}>
          {onOpenList && (
            <button
              type="button"
              className={styles.menuBtn}
              onClick={onOpenList}
              aria-label="Open conversations"
              title="Conversations"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className={styles.emptyHeaderText}>
            <p className={styles.emptyTitle}>Select a conversation</p>
            <p className={styles.emptyBody}>Customer chats will appear here when they message support.</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className={styles.window}>
      <header className={styles.header}>
        {onOpenList && (
          <button
            type="button"
            className={styles.menuBtn}
            onClick={onOpenList}
            aria-label="Open conversations"
            title="Conversations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {editingTitle ? (
          <input
            className={styles.titleInput}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
              if (e.key === 'Escape') {
                setTitleDraft(conversation.title ?? '')
                setEditingTitle(false)
              }
            }}
            autoFocus
            aria-label="Conversation title"
          />
        ) : (
          <button
            type="button"
            className={styles.titleBtn}
            onClick={() => {
              setTitleDraft(conversation.title ?? '')
              setEditingTitle(true)
            }}
            title="Click to rename"
          >
            {conversation.title?.trim() || 'New Chat'}
          </button>
        )}
        {conversation.status === 'closed' && (
          <span className={`${styles.statusBadge} ${styles.statusClosed}`}>
            closed
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            className={styles.headerDeleteBtn}
            title="Delete conversation"
            aria-label="Delete conversation"
            disabled={deleting}
            onClick={() => onDelete(conversation.id)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
            </svg>
          </button>
        )}
      </header>

      <div className={styles.metaBar}>
        <label className={styles.metaField}>
          <span className={styles.metaLabel}>Type</span>
          <select
            className={styles.metaSelect}
            value={conversation.support_category}
            disabled={savingMeta}
            onChange={e =>
              void saveConversationMeta({
                support_category: e.target.value as SupportCategory,
              })
            }
            aria-label="Support category"
          >
            <option value="platform">{SUPPORT_CATEGORY_LABELS.platform}</option>
            <option value="operational">{SUPPORT_CATEGORY_LABELS.operational}</option>
          </select>
        </label>

        <div className={styles.metaField}>
          <span className={styles.metaLabel}>Logged</span>
          <div className={styles.minutesControl}>
            <button
              type="button"
              className={styles.minutesBtn}
              disabled={savingMeta || conversation.logged_minutes <= 0}
              onClick={() =>
                void saveConversationMeta({
                  logged_minutes: conversation.logged_minutes - 5,
                })
              }
              aria-label="Decrease minutes by 5"
            >
              −
            </button>
            <span className={styles.minutesValue}>
              {formatLoggedMinutes(conversation.logged_minutes)}
            </span>
            <button
              type="button"
              className={styles.minutesBtn}
              disabled={savingMeta}
              onClick={() =>
                void saveConversationMeta({
                  logged_minutes: conversation.logged_minutes + 5,
                })
              }
              aria-label="Increase minutes by 5"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {offlineMessage && (
        <p className={styles.offlineBanner} role="status">
          {offlineMessage}
        </p>
      )}

      <div className={styles.messages}>
        {loading && <p className={styles.loading}>Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className={styles.loading}>No messages yet. Say hello.</p>
        )}
        {messages.map(msg => {
          const isAgent = msg.sender_type === 'agent'
          const isMine = msg.sender_id === currentUserId
          const mediaBubble =
            msg.message_type === 'image' ||
            msg.message_type === 'voice' ||
            msg.message_type === 'video'
          return (
            <div
              key={msg.id}
              className={`${styles.row} ${isAgent ? styles.rowAgent : styles.rowCustomer}`}
            >
              <div className={styles.bubbleWrap}>
                <div
                  className={`${styles.bubble} ${isAgent ? styles.bubbleAgent : styles.bubbleCustomer} ${
                    mediaBubble ? styles.bubbleMedia : ''
                  }`}
                >
                  <MessageBody message={msg} />
                </div>
                {isMine && (
                  <button
                    type="button"
                    className={styles.msgDeleteBtn}
                    title="Delete message"
                    aria-label="Delete message"
                    onClick={() => setPendingDelete(msg)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                    </svg>
                  </button>
                )}
              </div>
              <div className={styles.meta}>
                <span>{msg.sender_name}</span>
                <span>{formatMsgTime(msg.created_at)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form className={styles.composer} onSubmit={handleSend}>
        <ImageUploader
          conversationId={conversation.id}
          senderId={currentUserId}
          senderType="agent"
          disabled={conversation.status === 'closed' || voiceActive || shotActive || recActive}
          onActiveChange={setImageActive}
          onError={setError}
          onSent={(row) => {
            nameCache.current[currentUserId] = currentUserName
            appendLocalMessage(row, currentUserName)
          }}
        />
        <ScreenshotCapture
          conversationId={conversation.id}
          senderId={currentUserId}
          senderType="agent"
          disabled={conversation.status === 'closed' || voiceActive || imageActive || recActive}
          onActiveChange={setShotActive}
          onError={setError}
          onSent={(row) => {
            nameCache.current[currentUserId] = currentUserName
            appendLocalMessage(row, currentUserName)
          }}
        />
        <VoiceRecorder
          conversationId={conversation.id}
          senderId={currentUserId}
          senderType="agent"
          disabled={conversation.status === 'closed' || imageActive || shotActive || recActive}
          onActiveChange={setVoiceActive}
          onError={setError}
          onSent={(row) => {
            nameCache.current[currentUserId] = currentUserName
            appendLocalMessage(row, currentUserName)
          }}
        />
        <ScreenRecorder
          conversationId={conversation.id}
          senderId={currentUserId}
          senderType="agent"
          disabled={conversation.status === 'closed' || voiceActive || imageActive || shotActive}
          onActiveChange={setRecActive}
          onError={setError}
          onSent={(row) => {
            nameCache.current[currentUserId] = currentUserName
            appendLocalMessage(row, currentUserName)
          }}
        />
        <input
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a message…"
          disabled={sending || mediaActive || conversation.status === 'closed'}
          aria-label="Message"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={
            sending ||
            mediaActive ||
            !draft.trim() ||
            conversation.status === 'closed'
          }
        >
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </form>

      {pendingDelete && (
        <ConfirmModal
          title="Delete message?"
          message="This will remove the message for everyone in this chat. This cannot be undone."
          confirmLabel="Delete"
          danger
          loading={deletingMsg}
          onConfirm={() => void confirmDeleteMessage()}
          onClose={() => {
            if (!deletingMsg) setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
