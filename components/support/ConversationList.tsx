'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import ConfirmModal from '@/components/modals/ConfirmModal'
import ChatWindow from './ChatWindow'
import TenantBranchFilter from './TenantBranchFilter'
import type { ConversationItem, TenantGroup } from './types'
import {
  formatLastMessageAgo,
  groupConversationsByTenant,
  mapConversationRow,
} from './types'
import {
  clearSupportUnread,
  markSupportCustomerMessage,
  setActiveSupportConversation,
  subscribeSupportUnread,
  subscribeSupportUnreadDom,
} from '@/lib/support/unreadStore'
import {
  branchOptionsFor,
  matchesBranchFilter,
} from '@/lib/support/branch-filter'
import { subscribeToConversationMeta } from '@/lib/support/realtime'
import styles from './ConversationList.module.css'

interface Props {
  initialGroups:   TenantGroup[]
  currentUserId:   string
  currentUserName: string
  /** Only show / sync conversations for this product (`resto` | `alma`). */
  productFilter:   'resto' | 'alma'
}

export default function ConversationList({
  initialGroups,
  currentUserId,
  currentUserName,
  productFilter,
}: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialGroups[0]?.conversations[0]?.id ?? null
  )
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set())
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'conversation'; id: string; label: string }
    | { kind: 'tenant'; tenantId: string; label: string; conversationIds: string[] }
    | null
  >(null)
  const [listOpen, setListOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedTenants, setCollapsedTenants] = useState<Set<string>>(
    () => new Set(initialGroups.map(g => g.tenant_id))
  )
  /** Per-tenant branch filter: `all` | `none` | branch_id */
  const [branchFilterByTenant, setBranchFilterByTenant] = useState<
    Record<string, string>
  >({})
  // Tick so relative "X mins ago" labels refresh without new messages.
  const [, setNowTick] = useState(0)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const productFilterRef = useRef(productFilter)
  productFilterRef.current = productFilter

  const flat = groups.flatMap(g => g.conversations)

  function branchFilterFor(tenantId: string) {
    return branchFilterByTenant[tenantId] ?? 'all'
  }

  const selected = flat.find(c => c.id === selectedId) ?? null

  useEffect(() => {
    setActiveSupportConversation(selectedId)
  }, [selectedId])

  useEffect(() => {
    return () => setActiveSupportConversation(null)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(t => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Keep local unread dots in sync with shared store (+ DOM bridge)
  useEffect(() => {
    const unsubStore = subscribeSupportUnread(snap => {
      setUnreadIds(new Set(snap.conversationIds))
      setMessageCounts({ ...snap.messageCounts })
    })
    const unsubDom = subscribeSupportUnreadDom(
      detail => {
        setUnreadIds(prev => {
          if (prev.has(detail.conversationId)) return prev
          const next = new Set(prev)
          next.add(detail.conversationId)
          return next
        })
        setMessageCounts(prev => ({
          ...prev,
          [detail.conversationId]: detail.totalForConversation,
        }))
      },
      conversationId => {
        if (!conversationId) {
          setUnreadIds(new Set())
          setMessageCounts({})
          return
        }
        setUnreadIds(prev => {
          if (!prev.has(conversationId)) return prev
          const next = new Set(prev)
          next.delete(conversationId)
          return next
        })
        setMessageCounts(prev => {
          if (!(conversationId in prev)) return prev
          const { [conversationId]: _, ...rest } = prev
          return rest
        })
      }
    )
    return () => {
      unsubStore()
      unsubDom()
    }
  }, [])

  // Expand any tenant that has unread so the chat row (and red dot) is visible
  useEffect(() => {
    if (unreadIds.size === 0) return
    setCollapsedTenants(prev => {
      let changed = false
      const next = new Set(prev)
      for (const group of groups) {
        const hasUnread = group.conversations.some(
          c => unreadIds.has(c.id)
        )
        if (hasUnread && next.has(group.tenant_id)) {
          next.delete(group.tenant_id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [unreadIds, groups])

  const bumpActivity = useCallback((conversationId: string, at: string) => {
    setGroups(prev => {
      const all = prev.flatMap(g => g.conversations)
      if (!all.some(c => c.id === conversationId)) return prev
      const next = all.map(c =>
        c.id === conversationId
          ? { ...c, last_message_at: at, has_messages: true }
          : c
      )
      return groupConversationsByTenant(next)
    })
  }, [])

  const ensureConversationInList = useCallback(async (conversationId: string) => {
    if (groupsRef.current.flatMap(g => g.conversations).some(c => c.id === conversationId)) {
      return
    }

    const supabase = createClient()
    const { data } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('product', productFilterRef.current)
      .maybeSingle()

    if (!data) return

    setGroups(prev => {
      const flat = prev.flatMap(g => g.conversations)
      if (flat.some(c => c.id === String(data.id))) return prev
      return groupConversationsByTenant([
        mapConversationRow(data as Record<string, unknown>, null, true),
        ...flat,
      ])
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
            const rowProduct = String(row.product ?? 'resto')
            if (rowProduct !== productFilterRef.current) return

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
        // Any new message → bump activity + mark unread for customer messages
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'support_messages',
          },
          (payload) => {
            const row = payload.new as {
              id?: string
              conversation_id?: string
              created_at?: string
              sender_type?: string
            }
            if (!row.conversation_id) return

            const known = groupsRef.current
              .flatMap(g => g.conversations)
              .some(c => c.id === row.conversation_id)

            // Only touch list/unread for chats in this product module.
            // Unknown ids are fetched with product filter in ensureConversationInList.
            if (known) {
              if (row.created_at) {
                bumpActivity(row.conversation_id, row.created_at)
              }
              if (row.sender_type === 'customer') {
                markSupportCustomerMessage(
                  row.conversation_id,
                  row.id,
                  productFilterRef.current
                )
              }
              return
            }

            if (row.sender_type === 'customer') {
              void (async () => {
                await ensureConversationInList(row.conversation_id!)
                const nowKnown = groupsRef.current
                  .flatMap(g => g.conversations)
                  .some(c => c.id === row.conversation_id)
                if (!nowKnown) return
                if (row.created_at) {
                  bumpActivity(row.conversation_id!, row.created_at)
                }
                markSupportCustomerMessage(
                  row.conversation_id!,
                  row.id,
                  productFilterRef.current
                )
              })()
            }
          }
        )
        .subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [bumpActivity, ensureConversationInList])

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
      kind: 'conversation',
      id,
      label: conv?.title?.trim() || 'New Chat',
    })
  }

  function requestDeleteTenant(tenantId: string) {
    const group = groups.find(g => g.tenant_id === tenantId)
    if (!group) return
    if (group.conversations.some(c => c.has_messages)) return
    setPendingDelete({
      kind: 'tenant',
      tenantId,
      label: group.tenant_name,
      conversationIds: group.conversations.map(c => c.id),
    })
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    setError(null)
    const deletingKey =
      pendingDelete.kind === 'tenant'
        ? `tenant:${pendingDelete.tenantId}`
        : pendingDelete.id
    setDeletingId(deletingKey)
    let deleteError: string | null = null

    try {
      if (pendingDelete.kind === 'tenant') {
        const response = await fetch(
          `/api/support/conversations/by-tenant?tenant_id=${encodeURIComponent(pendingDelete.tenantId)}`,
          { method: 'DELETE' }
        )
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          deleteError = result.error ?? 'Failed to delete tenant chats'
        }
      } else {
        const response = await fetch(
          `/api/support/conversations/${encodeURIComponent(pendingDelete.id)}`,
          { method: 'DELETE' }
        )
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          deleteError = result.error ?? 'Failed to delete conversation'
        }
      }
    } catch {
      deleteError =
        pendingDelete.kind === 'tenant'
          ? 'Failed to delete tenant chats'
          : 'Failed to delete conversation'
    }

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError)
      return
    }

    if (pendingDelete.kind === 'tenant') {
      const remove = new Set(pendingDelete.conversationIds)
      const remaining = flat.filter(c => !remove.has(c.id))
      setGroups(groupConversationsByTenant(remaining))
      for (const id of pendingDelete.conversationIds) {
        clearSupportUnread(id)
      }
      if (selectedId && remove.has(selectedId)) {
        setSelectedId(remaining[0]?.id ?? null)
      }
    } else {
      const remaining = flat.filter(c => c.id !== pendingDelete.id)
      setGroups(groupConversationsByTenant(remaining))
      clearSupportUnread(pendingDelete.id)
      if (selectedId === pendingDelete.id) {
        setSelectedId(remaining[0]?.id ?? null)
      }
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

  const allCollapsed =
    groups.length > 0 && groups.every(g => collapsedTenants.has(g.tenant_id))

  function toggleCollapseAll() {
    if (allCollapsed) {
      setCollapsedTenants(new Set())
      return
    }
    setCollapsedTenants(new Set(groups.map(g => g.tenant_id)))
  }

  return (
    <div className={styles.shell}>
      {pendingDelete && (
        <ConfirmModal
          title={
            pendingDelete.kind === 'tenant'
              ? 'Delete empty tenant'
              : 'Delete conversation'
          }
          message={
            pendingDelete.kind === 'tenant'
              ? `Remove “${pendingDelete.label}” and all ${pendingDelete.conversationIds.length} empty chat${pendingDelete.conversationIds.length === 1 ? '' : 's'}? None of these chats have messages. This cannot be undone.`
              : `Delete “${pendingDelete.label}”? All messages and uploaded files in this chat will be permanently removed. This cannot be undone.`
          }
          confirmLabel="Delete"
          danger
          loading={
            deletingId ===
            (pendingDelete.kind === 'tenant'
              ? `tenant:${pendingDelete.tenantId}`
              : pendingDelete.id)
          }
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
            {groups.length > 1 && (
              <button
                type="button"
                className={styles.collapseAllBtn}
                onClick={toggleCollapseAll}
                aria-label={allCollapsed ? 'Expand all tenants' : 'Collapse all tenants'}
                title={allCollapsed ? 'Expand all tenants' : 'Collapse all tenants'}
              >
                {allCollapsed ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 13l5 5 5-5" />
                    <path d="M7 6l5 5 5-5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 11l5-5 5 5" />
                    <path d="M7 18l5-5 5 5" />
                  </svg>
                )}
              </button>
            )}
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
            <p className={styles.empty}>
              No conversations yet. Waiting for customers to start a chat.
            </p>
          )}

          {groups.map(group => {
            const filter = branchFilterFor(group.tenant_id)
            const { options: branchOptions, hasUnlabeled } = branchOptionsFor(
              group.conversations
            )
            const showBranchFilter =
              branchOptions.length > 0 || hasUnlabeled
            const visibleConversations = group.conversations.filter(c =>
              matchesBranchFilter(c, filter)
            )
            const collapsed = collapsedTenants.has(group.tenant_id)
            const groupUnreadMsgs = visibleConversations.reduce((sum, c) => {
              return sum + (messageCounts[c.id] ?? (unreadIds.has(c.id) ? 1 : 0))
            }, 0)
            const groupHasUnread = groupUnreadMsgs > 0
            const tenantEmpty =
              group.conversations.length > 0 &&
              group.conversations.every(c => !c.has_messages)
            return (
              <div key={group.tenant_id} className={styles.tenantGroup}>
                <div className={styles.tenantHeaderRow}>
                  <button
                    type="button"
                    className={`${styles.tenantHeader} ${
                      groupHasUnread ? styles.tenantHeaderUnread : ''
                    }`}
                    onClick={() => toggleTenant(group.tenant_id)}
                    aria-expanded={!collapsed}
                  >
                    {groupHasUnread && (
                      <span className={styles.tenantDot} aria-hidden="true" />
                    )}
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
                      {visibleConversations.length}
                      {filter !== 'all' && visibleConversations.length !== group.conversations.length
                        ? `/${group.conversations.length}`
                        : ''}
                    </span>
                    {groupHasUnread && (
                      <span
                        className={styles.tenantUnread}
                        aria-label={`${groupUnreadMsgs} new messages`}
                      >
                        {groupUnreadMsgs > 99 ? '99+' : groupUnreadMsgs}
                      </span>
                    )}
                  </button>
                  {!collapsed && showBranchFilter && (
                    <TenantBranchFilter
                      tenantId={group.tenant_id}
                      tenantName={group.tenant_name}
                      value={filter}
                      options={branchOptions}
                      hasUnlabeled={hasUnlabeled}
                      onChange={value =>
                        setBranchFilterByTenant(prev => ({
                          ...prev,
                          [group.tenant_id]: value,
                        }))
                      }
                    />
                  )}
                  {tenantEmpty && (
                    <button
                      type="button"
                      className={styles.tenantDeleteBtn}
                      title="Delete empty tenant chats"
                      aria-label={`Delete empty tenant ${group.tenant_name}`}
                      disabled={deletingId === `tenant:${group.tenant_id}`}
                      onClick={e => {
                        e.stopPropagation()
                        requestDeleteTenant(group.tenant_id)
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
                {!collapsed && (
                  <ul className={styles.convList} role="list">
                    {visibleConversations.length === 0 ? (
                      <li className={styles.filterEmpty}>
                        No chats for this branch
                      </li>
                    ) : (
                      visibleConversations.map(conv => {
                      const unreadCount = messageCounts[conv.id] ?? 0
                      const isUnread =
                        unreadCount > 0 || unreadIds.has(conv.id)
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
                              {isUnread && (
                                <span className={styles.unreadPill}>
                                  {unreadCount > 1 ? unreadCount : 'New'}
                                </span>
                              )}
                              {/* Only show when closed — "open" is the default and just noise */}
                              {conv.status === 'closed' && (
                                <span className={`${styles.badge} ${styles.badgeClosed}`}>
                                  closed
                                </span>
                              )}
                            </div>
                            <div className={styles.convContext} title={`${conv.tenant_name} · ${conv.branch_name?.trim() || 'No branch'}`}>
                              <span className={styles.convTenant}>{conv.tenant_name}</span>
                              <span className={styles.convContextSep} aria-hidden="true">·</span>
                              <span className={styles.convBranch}>
                                {conv.branch_name?.trim() || 'No branch'}
                              </span>
                            </div>
                            <div className={styles.convMeta}>
                              <span>{conv.assigned_name ?? 'Unassigned'}</span>
                              <span>{formatLastMessageAgo(conv.last_message_at ?? conv.created_at)}</span>
                            </div>
                          </button>
                        </li>
                      )
                    })
                    )}
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
          onComposerFocus={() => {
            if (selectedId) clearSupportUnread(selectedId)
          }}
          deleting={deletingId === selected?.id}
        />
      </section>
    </div>
  )
}
