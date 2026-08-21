/**
 * Shared in-memory unread store for support customer messages.
 * Used by ConversationList, NotificationBell, and Sidebar.
 *
 * State lives on globalThis so duplicate module instances (Next/HMR)
 * still share one unread map — otherwise sound can fire while the
 * chat list never sees badges.
 */

import { playSupportNotifySound } from '@/lib/support/notifySound'

export type SupportUnreadSnapshot = {
  conversationIds: Set<string>
  messageCounts: Record<string, number>
}

export type SupportUnreadDetail = {
  conversationId: string
  messageId?: string
  totalForConversation: number
}

type Listener = (snapshot: SupportUnreadSnapshot) => void

const EVENT_MARKED = 'ntg-support-unread-marked'
const EVENT_CLEARED = 'ntg-support-unread-cleared'

type StoreState = {
  listeners: Set<Listener>
  unreadIds: Set<string>
  messageCounts: Record<string, number>
  activeConversationId: string | null
  seenMessageIds: Set<string>
}

const GLOBAL_KEY = '__ntgSupportUnreadStore'

function getState(): StoreState {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: StoreState
  }
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      listeners: new Set(),
      unreadIds: new Set(),
      messageCounts: {},
      activeConversationId: null,
      seenMessageIds: new Set(),
    }
  }
  return g[GLOBAL_KEY]
}

function snapshot(): SupportUnreadSnapshot {
  const s = getState()
  return {
    conversationIds: new Set(s.unreadIds),
    messageCounts: { ...s.messageCounts },
  }
}

function emit() {
  const snap = snapshot()
  for (const listener of getState().listeners) listener(snap)
}

function dispatchBrowserEvent(
  name: string,
  detail: Record<string, unknown>
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

export function getSupportUnreadMessageTotal(
  snap: SupportUnreadSnapshot = snapshot()
): number {
  return Object.values(snap.messageCounts).reduce((a, b) => a + b, 0)
}

export function getSupportUnreadCount() {
  return getState().unreadIds.size
}

export function setActiveSupportConversation(id: string | null) {
  getState().activeConversationId = id
  // Do not auto-clear unread here. Unread for the open chat can still matter when
  // the tab was in the background; clear only on explicit agent attention
  // (list click / composer focus).
}

/**
 * Increment unread for a customer message.
 * Returns false if ignored (empty id, focused tab already viewing this chat, or duplicate).
 */
export function markSupportCustomerMessage(
  conversationId: string,
  messageId?: string
): boolean {
  const s = getState()
  if (!conversationId) return false

  const viewingThisChat = conversationId === s.activeConversationId
  const tabHidden = typeof document !== 'undefined' && document.hidden
  // Same chat in a focused tab: messages appear live — skip notify.
  // Same chat in a background tab: still notify so the agent notices.
  if (viewingThisChat && !tabHidden) return false

  if (messageId) {
    if (s.seenMessageIds.has(messageId)) return false
    s.seenMessageIds.add(messageId)
    if (s.seenMessageIds.size > 400) {
      const keep = [...s.seenMessageIds].slice(-200)
      s.seenMessageIds.clear()
      for (const id of keep) s.seenMessageIds.add(id)
    }
  }

  s.unreadIds.add(conversationId)
  s.messageCounts[conversationId] = (s.messageCounts[conversationId] ?? 0) + 1
  emit()
  dispatchBrowserEvent(EVENT_MARKED, {
    conversationId,
    messageId,
    totalForConversation: s.messageCounts[conversationId],
  } satisfies SupportUnreadDetail)
  playSupportNotifySound()
  return true
}

/** @deprecated Prefer markSupportCustomerMessage */
export function markSupportUnread(conversationId: string) {
  markSupportCustomerMessage(conversationId)
}

export function clearSupportUnread(conversationId?: string) {
  const s = getState()
  if (!conversationId) {
    if (s.unreadIds.size === 0 && Object.keys(s.messageCounts).length === 0) return
    s.unreadIds = new Set()
    s.messageCounts = {}
    emit()
    dispatchBrowserEvent(EVENT_CLEARED, { conversationId: null })
    return
  }
  if (!s.unreadIds.has(conversationId) && !(s.messageCounts[conversationId] ?? 0)) {
    return
  }
  s.unreadIds.delete(conversationId)
  const { [conversationId]: _, ...rest } = s.messageCounts
  s.messageCounts = rest
  emit()
  dispatchBrowserEvent(EVENT_CLEARED, { conversationId })
}

export function subscribeSupportUnread(listener: Listener) {
  const s = getState()
  s.listeners.add(listener)
  listener(snapshot())
  return () => {
    s.listeners.delete(listener)
  }
}

/** DOM bridge so UI updates even if module instances diverge. */
export function subscribeSupportUnreadDom(
  onMarked: (detail: SupportUnreadDetail) => void,
  onCleared?: (conversationId: string | null) => void
) {
  if (typeof window === 'undefined') return () => {}

  function handleMarked(e: Event) {
    const detail = (e as CustomEvent<SupportUnreadDetail>).detail
    if (detail?.conversationId) onMarked(detail)
  }

  function handleCleared(e: Event) {
    const conversationId =
      (e as CustomEvent<{ conversationId: string | null }>).detail
        ?.conversationId ?? null
    onCleared?.(conversationId)
  }

  window.addEventListener(EVENT_MARKED, handleMarked)
  window.addEventListener(EVENT_CLEARED, handleCleared)
  return () => {
    window.removeEventListener(EVENT_MARKED, handleMarked)
    window.removeEventListener(EVENT_CLEARED, handleCleared)
  }
}
