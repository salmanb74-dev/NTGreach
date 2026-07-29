'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import ConfirmModal from '@/components/modals/ConfirmModal'
import ChatWindow from './ChatWindow'
import type { ConversationItem, TenantGroup } from './types'
import {
  formatLastMessageAgo,
  groupConversationsByTenant,
  mapConversationRow,
} from './types'
import {
  clearSupportUnread,
  setActiveSupportConversation,
  subscribeSupportUnread,
} from '@/lib/support/unreadStore'
import { subscribeToConversationMeta } from '@/lib/support/realtime'
import styles from './ConversationList.module.css'

interface Props {
  initialGroups:   TenantGroup[]
  currentUserId:   string
  currentUserName: string
}

export default function ConversationList({
  initialGroups,
  currentUserId,
  currentUserName,
}: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialGroups[0]?.conversations[0]?.id ?? null
  )
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set())
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedTenants, setCollapsedTenants] = useState<Set<string>>(() => new Set())
  // Tick so relative "X mins ago" labels refresh without new messages.
  const [, setNowTick] = useState(0)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const flat = groups.flatMap(g => g.conversations)
  const selected = flat.find(c => c.id === selectedId) ?? null

  useEffect(() => {
    setActiveSupportConversation(selectedId)
    return () => setActiveSupportConversation(null)
  }, [selectedId])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(t => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Keep local unread dots in sync with shared store
  useEffect(() => {
    return subscribeSupportUnread(snap => {
      setUnreadIds(snap.conversationIds)
      setMessageCounts(snap.messageCounts)
    })
  }, [])

  const bumpActivity = useCallback((conversationId: string, at: string) => {
    setGroups(prev => {
      const all = prev.flatMap(g => g.conversations).map(c =>
        c.id === conversationId ? { ...c, last_message_at: at } : c
      )
      return groupConversationsByTenant(all)
    })
  }, [])

  const applyMeta = useCallback((row: {
    id: string
    title?: string | null
    last_message_at?: string | null
    status?: ConversationItem['status']
    support_category?: ConversationItem['support_category']
    logged_minutes?: number
  }) => {
    setGroups(prev => {
      const all = prev.flatMap(g => g.conversations)
      if (!all.some(c => c.id === row.id)) return prev
      const next = all.map(c =>
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
      return groupConversationsByTenant(next)
    })
  }, [])

  // Title / activity from other tabs (broadcast — more reliable than UPDATE alone)
  useEffect(() => {
    return subscribeToConversationMeta(applyMeta)
  }, [applyMeta])

  // Realtime list sync — enable support_conversations + support_messages in Replication
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setup() {
      await ensureRealtimeAuth(supabase)
      if (cancelled) return

      channel = supabase
        .channel('support-conversations-list')
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'support_conversations',
          },
          (payload) => {
            const row = payload.new as ConversationItem & {
              last_message_at?: string | null
              title?: string | null
              status?: ConversationItem['status']
              assigned_to?: string | null
            }

            setGroups(prev => {
              const all = prev.flatMap(g => g.conversations)
              const exists = all.some(c => c.id === row.id)
              if (!exists) return prev

              const next = all.map(c =>
                c.id === row.id
                  ? {
                      ...c,
                      title:            row.title !== undefined ? row.title : c.title,
                      status:           row.status ?? c.status,
                      assigned_to:      row.assigned_to !== undefined ? row.assigned_to : c.assigned_to,
                      last_message_at:  row.last_message_at ?? c.last_message_at,
                      closed_at:        row.closed_at !== undefined ? row.closed_at : c.closed_at,
                      support_category: row.support_category ?? c.support_category,
                      logged_minutes:   row.logged_minutes ?? c.logged_minutes,
                    }
                  : c
              )
              return groupConversationsByTenant(next)
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'support_conversations',
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>
            setGroups(prev => {
              const all = prev.flatMap(g => g.conversations)
              if (all.some(c => c.id === String(row.id))) return prev
              const item = mapConversationRow(row)
              return groupConversationsByTenant([item, ...all])
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event:  'DELETE',
            schema: 'public',
            table:  'support_conversations',
          },
          (payload) => {
            const row = payload.old as { id?: string }
            if (!row.id) return
            setGroups(prev => {
              const remaining = prev.flatMap(g => g.conversations).filter(c => c.id !== row.id)
              return groupConversationsByTenant(remaining)
            })
            clearSupportUnread(row.id)
            if (selectedIdRef.current === row.id) {
              setSelectedId(null)
            }
          }
        )
        // Any new message → bump activity + re-sort (even if conversation UPDATE lags)
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
            bumpActivity(row.conversation_id, row.created_at)
          }
        )
        .subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [bumpActivity])

  function handleTitleChange(id: string, title: string | null) {
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        conversations: g.conversations.map(c =>
          c.id === id ? { ...c, title } : c
        ),
      }))
    )
  }

  function handleConversationPatch(
    id: string,
    patch: Partial<Pick<ConversationItem, 'support_category' | 'logged_minutes' | 'title'>>
  ) {
    setGroups(prev =>
      prev.map(g => ({
        ...g,
        conversations: g.conversations.map(c =>
          c.id === id ? { ...c, ...patch } : c
        ),
      }))
    )
  }

  function requestDelete(id: string) {
    const conv = flat.find(c => c.id === id)
    setPendingDelete({
      id,
      label: conv?.title?.trim() || 'New Chat',
    })
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete

    setError(null)
    setDeletingId(id)
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('support_conversations')
      .delete()
      .eq('id', id)

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    const remaining = flat.filter(c => c.id !== id)
    setGroups(groupConversationsByTenant(remaining))
    clearSupportUnread(id)
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null)
    }
    setPendingDelete(null)
  }

  function selectConversation(id: string) {
    setSelectedId(id)
    clearSupportUnread(id)
    setListOpen(false)
  }

  function toggleTenant(tenantId: string) {
    setCollapsedTenants(prev => {
      const next = new Set(prev)
      if (next.has(tenantId)) next.delete(tenantId)
      else next.add(tenantId)
      return next
    })
  }

  return (
    <div className={styles.shell}>
      {pendingDelete && (
        <ConfirmModal
          title="Delete conversation"
          message={`Delete “${pendingDelete.label}”? All messages in this chat will be removed. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          loading={deletingId === pendingDelete.id}
          onConfirm={confirmDelete}
          onClose={() => {
            if (deletingId) return
            setPendingDelete(null)
          }}
        />
      )}
      {listOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close conversation list"
          onClick={() => setListOpen(false)}
        />
      )}

      <aside className={`${styles.listPanel} ${listOpen ? styles.listOpen : ''}`}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Conversations</h2>
          <div className={styles.listHeaderActions}>
            <button
              type="button"
              className={styles.closeListBtn}
              onClick={() => setListOpen(false)}
              aria-label="Close conversation list"
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
          {groups.length === 0 && (
            <p className={styles.empty}>No conversations yet. Waiting for customers to start a chat.</p>
          )}

          {groups.map(group => {
            const collapsed = collapsedTenants.has(group.tenant_id)
            const groupUnreadMsgs = group.conversations.reduce((sum, c) => {
              if (c.id === selectedId) return sum
              return sum + (messageCounts[c.id] ?? 0)
            }, 0)
            return (
              <div key={group.tenant_id} className={styles.tenantGroup}>
                <button
                  type="button"
                  className={styles.tenantHeader}
                  onClick={() => toggleTenant(group.tenant_id)}
                  aria-expanded={!collapsed}
                >
                  <svg
                    className={`${styles.tenantChevron} ${collapsed ? styles.tenantChevronCollapsed : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  <span className={styles.tenantName}>{group.tenant_name}</span>
                  <span className={styles.tenantCount}>
                    {group.conversations.length}
                  </span>
                  {groupUnreadMsgs > 0 && collapsed && (
                    <span
                      className={styles.tenantUnread}
                      aria-label={`${groupUnreadMsgs} new messages`}
                    >
                      {groupUnreadMsgs > 99 ? '99+' : groupUnreadMsgs}
                    </span>
                  )}
                </button>
                {!collapsed && (
                  <ul className={styles.convList} role="list">
                    {group.conversations.map(conv => {
                      const isUnread = unreadIds.has(conv.id) && selectedId !== conv.id
                      return (
                        <li key={conv.id}>
                          <button
                            type="button"
                            className={`${styles.convItem} ${selectedId === conv.id ? styles.convActive : ''} ${isUnread ? styles.convUnread : ''}`}
                            onClick={() => selectConversation(conv.id)}
                          >
                            <div className={styles.convTop}>
                              <span className={styles.convTitle}>
                                {isUnread && <span className={styles.unreadDot} aria-hidden="true" />}
                                {conv.title?.trim() || 'New Chat'}
                              </span>
                              {/* Only show when closed — "open" is the default and just noise */}
                              {conv.status === 'closed' && (
                                <span className={`${styles.badge} ${styles.badgeClosed}`}>
                                  closed
                                </span>
                              )}
                            </div>
                            <div className={styles.convMeta}>
                              <span>{conv.assigned_name ?? 'Unassigned'}</span>
                              <span>{formatLastMessageAgo(conv.last_message_at ?? conv.created_at)}</span>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <section className={styles.chatPanel}>
        <ChatWindow
          conversation={selected}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onTitleChange={handleTitleChange}
          onConversationPatch={handleConversationPatch}
          onDelete={requestDelete}
          onOpenList={() => setListOpen(true)}
          onMessageActivity={bumpActivity}
          deleting={deletingId === selected?.id}
        />
      </section>
    </div>
  )
}
