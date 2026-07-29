/**
 * Shared in-memory unread store for support customer messages.
 * Used by ConversationList, NotificationBell, and Sidebar.
 */

export type SupportUnreadSnapshot = {
  conversationIds: Set<string>
  messageCounts: Record<string, number>
}

type Listener = (snapshot: SupportUnreadSnapshot) => void

const listeners = new Set<Listener>()
let unreadIds = new Set<string>()
let messageCounts: Record<string, number> = {}
let activeConversationId: string | null = null

function snapshot(): SupportUnreadSnapshot {
  return {
    conversationIds: new Set(unreadIds),
    messageCounts: { ...messageCounts },
  }
}

function emit() {
  const snap = snapshot()
  for (const listener of listeners) listener(snap)
}

export function getSupportUnreadMessageTotal(
  snap: SupportUnreadSnapshot = snapshot()
): number {
  return Object.values(snap.messageCounts).reduce((a, b) => a + b, 0)
}

export function getSupportUnreadCount() {
  return unreadIds.size
}

export function setActiveSupportConversation(id: string | null) {
  activeConversationId = id
  if (id && (unreadIds.has(id) || (messageCounts[id] ?? 0) > 0)) {
    const next = new Set(unreadIds)
    next.delete(id)
    unreadIds = next
    const { [id]: _, ...rest } = messageCounts
    messageCounts = rest
    emit()
  }
}

/** Increment unread message count for a conversation (customer message). */
export function markSupportCustomerMessage(conversationId: string) {
  if (!conversationId || conversationId === activeConversationId) return
  unreadIds.add(conversationId)
  messageCounts[conversationId] = (messageCounts[conversationId] ?? 0) + 1
  emit()
}

/** @deprecated Prefer markSupportCustomerMessage */
export function markSupportUnread(conversationId: string) {
  markSupportCustomerMessage(conversationId)
}

export function clearSupportUnread(conversationId?: string) {
  if (!conversationId) {
    if (unreadIds.size === 0 && Object.keys(messageCounts).length === 0) return
    unreadIds = new Set()
    messageCounts = {}
    emit()
    return
  }
  if (!unreadIds.has(conversationId) && !(messageCounts[conversationId] ?? 0)) return
  const next = new Set(unreadIds)
  next.delete(conversationId)
  unreadIds = next
  const { [conversationId]: _, ...rest } = messageCounts
  messageCounts = rest
  emit()
}

export function subscribeSupportUnread(listener: Listener) {
  listeners.add(listener)
  listener(snapshot())
  return () => {
    listeners.delete(listener)
  }
}
