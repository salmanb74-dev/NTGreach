'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import {
  broadcastConversationMeta,
  broadcastDeleteMessage,
  broadcastNewMessage,
  subscribeToConversationMessages,
  subscribeToConversationMeta,
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
import type { ChatMessage, ConversationItem } from './types'
import {
  SUPPORT_CATEGORY_LABELS,
  formatLastMessageAgo,
  formatLoggedMinutes,
  mapConversationRow,
  sortConversationsByActivity,
} from './types'
import { getSupportCoverageState } from '@/lib/actions/support-shifts'
import styles from './SimulatorClient.module.css'

interface Props {
  initialConversations: ConversationItem[]
  currentUserId:        string
  tenantId:             string
  tenantName:           string
  customerDisplayName:  string
}

export default function SimulatorClient({
  initialConversations,
  currentUserId,
  tenantId,
  tenantName,
  customerDisplayName,
}: Props) {
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceActive, setVoiceActive] = useState(false)
  const [imageActive, setImageActive] = useState(false)
  const [shotActive, setShotActive] = useState(false)
  const [recActive, setRecActive] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null)
  // Tick so relative "X mins ago" labels refresh without new messages.
  const [, setNowTick] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nameCache = useRef<Record<string, string>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const mediaActive = voiceActive || imageActive || shotActive || recActive

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const composerLocked = selected?.status === 'closed'

  const monthTotals = useMemo(() => {
    const thisMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year:  'numeric',
      month: '2-digit',
    }).format(new Date())

    let platform = 0
    let operational = 0
    for (const c of conversations) {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year:  'numeric',
        month: '2-digit',
      }).format(new Date(c.created_at))
      if (key !== thisMonth) continue
      if (c.support_category === 'operational') operational += c.logged_minutes
      else platform += c.logged_minutes
    }

    return { platform, operational }
  }, [conversations])

  function bumpActivity(conversationId: string, at: string) {
    setConversations(prev =>
      sortConversationsByActivity(
        prev.map(c => (c.id === conversationId ? { ...c, last_message_at: at } : c))
      )
    )
  }

  const bumpActivityRef = useRef(bumpActivity)
  bumpActivityRef.current = bumpActivity

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(t => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Title / activity from support tab (and other clients)
  useEffect(() => {
    return subscribeToConversationMeta(row => {
      setConversations(prev => {
        if (!prev.some(c => c.id === row.id)) return prev
        return sortConversationsByActivity(
          prev.map(c =>
            c.id === row.id
              ? {
                  ...c,
                  title:            row.title !== undefined ? row.title : c.title,
                  status:           row.status ?? c.status,
                  last_message_at:  row.last_message_at ?? c.last_message_at,
                  support_category: row.support_category ?? c.support_category,
                  logged_minutes:   row.logged_minutes ?? c.logged_minutes,
                }
              : c
          )
        )
      })
    })
  }, [])

  function formatMsgTime(iso: string) {
    return new Date(iso).toLocaleString('en-PK', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Realtime list order — enable support_conversations in Database → Replication
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: RealtimeChannel | null = null

    async function setup() {
      await ensureRealtimeAuth(supabase)
      if (cancelled) return

      channel = supabase
        .channel(`simulator-conversations-list:${tenantId}`)
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'support_conversations',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const row = payload.new as ConversationItem
            setConversations(prev => {
              if (!prev.some(c => c.id === row.id)) return prev
              return sortConversationsByActivity(
                prev.map(c =>
                  c.id === row.id
                    ? {
                        ...c,
                        title:            row.title !== undefined ? row.title : c.title,
                        status:           row.status ?? c.status,
                        last_message_at:  row.last_message_at ?? c.last_message_at,
                        support_category: row.support_category ?? c.support_category,
                        logged_minutes:   row.logged_minutes ?? c.logged_minutes,
                      }
                    : c
                )
              )
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'support_conversations',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            setConversations(prev => {
              if (prev.some(c => c.id === String((payload.new as { id?: string }).id))) return prev
              const item = mapConversationRow(payload.new as Record<string, unknown>)
              return sortConversationsByActivity([item, ...prev])
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'support_messages',
          },
          (payload) => {
            const row = payload.new as { conversation_id?: string; created_at?: string }
            if (!row.conversation_id || !row.created_at) return
            bumpActivityRef.current(row.conversation_id, row.created_at)
          }
        )
        .subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [tenantId])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      channelRef.current = null
      return
    }

    let cancelled = false
    const supabase = createClient()
    const conversationId = selectedId

    async function resolveSenderName(senderId: string, senderType: string) {
      if (senderType === 'customer') return customerDisplayName
      if (nameCache.current[senderId]) return nameCache.current[senderId]
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', senderId)
        .maybeSingle()
      const name =
        profile?.full_name?.trim() || profile?.email || 'NTG Support'
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
      bumpActivityRef.current(row.conversation_id, row.created_at)
    }

    async function setup() {
      setLoading(true)
      setError(null)
      setDraft('')
      setVoiceActive(false)
      setImageActive(false)
      setShotActive(false)
      setRecActive(false)

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
          sender_name:
            r.sender_type === 'customer'
              ? customerDisplayName
              : (nameCache.current[r.sender_id] ?? 'NTG Support'),
          message_type:    r.message_type,
          content:         r.content,
          file_url:        r.file_url,
          created_at:      r.created_at,
          read_at:         r.read_at,
          expires_at:      r.expires_at ?? null,
        }))
      )
      setLoading(false)

      // Same channel name as ChatWindow so broadcast works across tabs
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
          if (cancelled) return
          setConversations(prev =>
            sortConversationsByActivity(
              prev.map(c =>
                c.id === conversationId
                  ? {
                      ...c,
                      title:           row.title !== undefined ? row.title : c.title,
                      last_message_at: row.last_message_at ?? c.last_message_at,
                    }
                  : c
              )
            )
          )
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
  }, [selectedId, customerDisplayName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  async function handleNewChat() {
    setError(null)
    setCreating(true)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('support_conversations')
      .insert({
        tenant_id:   tenantId,
        tenant_name: tenantName,
        status:      'open',
        created_by:  currentUserId,
        title:       null,
      })
      .select('*')
      .single()

    setCreating(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create chat')
      return
    }

    const item = mapConversationRow(data as Record<string, unknown>)

    setConversations(prev => sortConversationsByActivity([item, ...prev]))
    setSelectedId(item.id)
    setListOpen(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !draft.trim() || sending) return

    setSending(true)
    setError(null)
    const content = draft.trim()
    const supabase = createClient()

    const { data, error: insertError } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: selected.id,
        sender_id:       currentUserId,
        sender_type:     'customer',
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
    setDraft('')
    bumpActivity(selected.id, row.created_at)
    setMessages(prev => {
      if (prev.some(m => m.id === row.id)) return prev
      return [
        ...prev,
        {
          id:              row.id,
          conversation_id: row.conversation_id,
          sender_id:       row.sender_id,
          sender_type:     row.sender_type,
          sender_name:     customerDisplayName,
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
      id:              selected.id,
      last_message_at: row.created_at,
    })
  }

  function appendLocalMessage(row: SupportMessageRow, senderName: string) {
    bumpActivity(row.conversation_id, row.created_at)
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

  return (
    <div className={styles.shell}>
      <div className={styles.banner}>
        <strong>Resto Simulator — {tenantName}</strong>
        <span>Simulating customer view — temporary test tool</span>
      </div>

      <div className={styles.body}>
        {listOpen && (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close chat list"
            onClick={() => setListOpen(false)}
          />
        )}

        <aside className={`${styles.listPanel} ${listOpen ? styles.listOpen : ''}`}>
          <div className={styles.listHeader}>
            <div>
              <h2 className={styles.listTitle}>{tenantName}</h2>
              <p className={styles.listSub}>Customer chats</p>
              <div className={styles.monthTotals}>
                <span>
                  Platform {formatLoggedMinutes(monthTotals.platform)}
                </span>
                <span>
                  Operational {formatLoggedMinutes(monthTotals.operational)}
                </span>
              </div>
            </div>
            <div className={styles.listHeaderActions}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleNewChat}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'New Chat'}
              </Button>
              <button
                type="button"
                className={styles.closeListBtn}
                onClick={() => setListOpen(false)}
                aria-label="Close chat list"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.listScroll}>
            {conversations.length === 0 && (
              <p className={styles.empty}>No chats yet. Start one above.</p>
            )}
            <ul className={styles.convList} role="list">
              {conversations.map(conv => (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={`${styles.convItem} ${selectedId === conv.id ? styles.convActive : ''}`}
                    onClick={() => {
                      setSelectedId(conv.id)
                      setListOpen(false)
                    }}
                  >
                    <span className={styles.convTitle}>
                      {conv.title?.trim() || 'New Chat'}
                    </span>
                    <span className={styles.convTime}>
                      {formatLastMessageAgo(conv.last_message_at ?? conv.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className={styles.chatPanel}>
          {!selected ? (
            <div className={styles.emptyState}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setListOpen(true)}
                aria-label="Open chats"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <p className={styles.emptyTitle}>Select a chat</p>
              <p className={styles.emptyBody}>Or create a new one to message support.</p>
            </div>
          ) : (
            <>
              <header className={styles.chatHeader}>
                <button
                  type="button"
                  className={styles.menuBtn}
                  onClick={() => setListOpen(true)}
                  aria-label="Open chats"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h3 className={styles.chatTitle}>
                  {selected.title?.trim() || 'New Chat'}
                </h3>
                <div className={styles.chatMeta}>
                  <span className={styles.chatHint}>
                    {SUPPORT_CATEGORY_LABELS[selected.support_category]}
                  </span>
                  {selected.logged_minutes > 0 && (
                    <span className={styles.chatMinutes}>
                      {formatLoggedMinutes(selected.logged_minutes)} logged
                    </span>
                  )}
                </div>
              </header>

              {offlineMessage && (
                <p className={styles.offlineBanner} role="status">
                  {offlineMessage}
                </p>
              )}

              <div className={styles.messages}>
                {loading && <p className={styles.loading}>Loading…</p>}
                {!loading && messages.length === 0 && (
                  <p className={styles.loading}>No messages yet.</p>
                )}
                {messages.map(msg => {
                  const isMine = msg.sender_type === 'customer' && msg.sender_id === currentUserId
                  const mediaBubble =
                    msg.message_type === 'image' ||
                    msg.message_type === 'voice' ||
                    msg.message_type === 'video'
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.row} ${
                        msg.sender_type === 'customer' ? styles.rowMine : styles.rowTheirs
                      }`}
                    >
                      <div className={styles.bubbleWrap}>
                        <div
                          className={`${styles.bubble} ${
                            msg.sender_type === 'customer' ? styles.bubbleMine : styles.bubbleTheirs
                          } ${mediaBubble ? styles.bubbleMedia : ''}`}
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
                  conversationId={selected.id}
                  senderId={currentUserId}
                  senderType="customer"
                  disabled={!!composerLocked || voiceActive || shotActive || recActive}
                  onActiveChange={setImageActive}
                  onError={setError}
                  onSent={(row) => appendLocalMessage(row, customerDisplayName)}
                />
                <ScreenshotCapture
                  conversationId={selected.id}
                  senderId={currentUserId}
                  senderType="customer"
                  disabled={!!composerLocked || voiceActive || imageActive || recActive}
                  onActiveChange={setShotActive}
                  onError={setError}
                  onSent={(row) => appendLocalMessage(row, customerDisplayName)}
                />
                <ScreenRecorder
                  conversationId={selected.id}
                  senderId={currentUserId}
                  senderType="customer"
                  disabled={!!composerLocked || voiceActive || imageActive || shotActive}
                  onActiveChange={setRecActive}
                  onError={setError}
                  onSent={(row) => appendLocalMessage(row, customerDisplayName)}
                />
                <VoiceRecorder
                  conversationId={selected.id}
                  senderId={currentUserId}
                  senderType="customer"
                  disabled={!!composerLocked || imageActive || shotActive || recActive}
                  onActiveChange={setVoiceActive}
                  onError={setError}
                  onSent={(row) => appendLocalMessage(row, customerDisplayName)}
                />
                <input
                  className={styles.input}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Message NTG Support…"
                  disabled={sending || mediaActive || !!composerLocked}
                  aria-label="Customer message"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={
                    sending ||
                    mediaActive ||
                    !draft.trim() ||
                    !!composerLocked
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}
