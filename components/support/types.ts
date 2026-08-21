export type ConversationStatus = 'open' | 'closed'
export type SupportCategory = 'platform' | 'operational'

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  platform:    'Platform support',
  operational: 'Operational support',
}

export interface ConversationItem {
  id:              string
  tenant_id:       string
  tenant_name:     string
  title:           string | null
  status:          ConversationStatus
  created_by:      string
  assigned_to:     string | null
  assigned_name:   string | null
  created_at:      string
  last_message_at: string | null
  closed_at:       string | null
  product:         string
  support_category: SupportCategory
  logged_minutes:  number
  /** Resto branch at chat open; null for older chats / HQ / unknown. */
  branch_id:       string | null
  branch_name:     string | null
  /** True once at least one support_messages row exists for this chat. */
  has_messages:    boolean
}

/** Normalize DB / realtime rows into ConversationItem with safe defaults. */
export function mapConversationRow(
  row: Record<string, unknown>,
  assignedName: string | null = null,
  hasMessages = false
): ConversationItem {
  const category = row.support_category === 'operational' ? 'operational' : 'platform'
  const rawMinutes = Number(row.logged_minutes ?? 0)
  const loggedMinutes = Number.isFinite(rawMinutes)
    ? Math.max(0, Math.round(rawMinutes / 5) * 5)
    : 0

  const fromRow =
    typeof row.has_messages === 'boolean'
      ? row.has_messages
      : hasMessages

  return {
    id:              String(row.id),
    tenant_id:       String(row.tenant_id),
    tenant_name:     String(row.tenant_name),
    title:           (row.title as string | null) ?? null,
    status:          row.status === 'closed' ? 'closed' : 'open',
    created_by:      String(row.created_by),
    assigned_to:     (row.assigned_to as string | null) ?? null,
    assigned_name:   assignedName,
    created_at:      String(row.created_at),
    last_message_at: (row.last_message_at as string | null) ?? String(row.created_at),
    closed_at:       (row.closed_at as string | null) ?? null,
    product:         String(row.product ?? 'resto'),
    support_category: category,
    logged_minutes:  loggedMinutes,
    branch_id:
      typeof row.branch_id === 'string' && row.branch_id.trim()
        ? row.branch_id.trim()
        : null,
    branch_name:
      typeof row.branch_name === 'string' && row.branch_name.trim()
        ? row.branch_name.trim()
        : null,
    has_messages: fromRow,
  }
}

export function formatLoggedMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function snapMinutes(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value / 5) * 5)
}

export interface TenantGroup {
  tenant_id:     string
  tenant_name:   string
  conversations: ConversationItem[]
}

/** Message tallies for one direction of a support chat (rep-sent or customer-sent). */
export interface DirectionCounts {
  total: number
  text:  number
  image: number
  voice: number
  video: number
  file:  number
}

export interface SupportActivityRow {
  key:        string
  dateKey:    string
  dateLabel:  string
  tenantId:   string
  tenantName: string
  sent:       DirectionCounts
  received:   DirectionCounts
  lastAt:     string
}

export interface SupportTimeSession {
  id:        string
  clockIn:   string
  clockOut:  string | null
  durationMs: number
}

export interface SupportTimeDay {
  dateKey:    string
  dateLabel:  string
  sessions:   SupportTimeSession[]
  durationMs: number
}

export function emptyCounts(): DirectionCounts {
  return { total: 0, text: 0, image: 0, voice: 0, video: 0, file: 0 }
}

export interface ChatMessage {
  id:              string
  conversation_id: string
  sender_id:       string
  sender_type:     'agent' | 'customer'
  sender_name:     string
  message_type:    'text' | 'image' | 'voice' | 'video' | 'file'
  content:         string | null
  file_url:        string | null
  created_at:      string
  read_at:         string | null
  /** Screen recordings — file removed after this time. */
  expires_at?:     string | null
}

export function conversationActivityAt(c: ConversationItem): number {
  return new Date(c.last_message_at ?? c.created_at).getTime()
}

export function sortConversationsByActivity(items: ConversationItem[]): ConversationItem[] {
  return [...items].sort((a, b) => conversationActivityAt(b) - conversationActivityAt(a))
}

/** Group by tenant; tenants and conversations ordered by last activity desc. */
export function groupConversationsByTenant(items: ConversationItem[]): TenantGroup[] {
  const sorted = sortConversationsByActivity(items)
  const map = new Map<string, TenantGroup>()

  for (const item of sorted) {
    const existing = map.get(item.tenant_id)
    if (existing) {
      existing.conversations.push(item)
    } else {
      map.set(item.tenant_id, {
        tenant_id:     item.tenant_id,
        tenant_name:   item.tenant_name,
        conversations: [item],
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aMax = Math.max(...a.conversations.map(conversationActivityAt), 0)
    const bMax = Math.max(...b.conversations.map(conversationActivityAt), 0)
    return bMax - aMax
  })
}

export { formatLastMessageAgo } from '@/lib/format-when'
