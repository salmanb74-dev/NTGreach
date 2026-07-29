import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsManager } from '@/lib/roles'
import RepSelector from '@/components/reports/RepSelector'
import SupportActivityClient, {
  type ActivityRange,
} from '@/components/support/SupportActivityClient'
import {
  emptyCounts,
  type DirectionCounts,
  type SupportActivityRow,
  type SupportTimeDay,
} from '@/components/support/types'
import styles from './activity.module.css'

/** PostgREST caps a single response, so pull messages page by page. */
const PAGE_SIZE = 1000
const MAX_PAGES = 25

type MessageRow = {
  sender_id:    string
  sender_type:  string
  message_type: string
  created_at:   string
  support_conversations: {
    tenant_id:   string
    tenant_name: string
  } | null
}

type TimeLogRow = {
  id:        string
  clock_in:  string
  clock_out: string | null
}

/**
 * Days are bucketed in business-local time, not the server's timezone —
 * otherwise "Today" on a UTC host shifts for messages sent before 05:00 PKT.
 */
const DAY_TZ = 'Asia/Karachi'

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAY_TZ,
  year:  'numeric',
  month: '2-digit',
  day:   '2-digit',
})

const dayLongFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DAY_TZ,
  weekday: 'long',
  day:     'numeric',
  month:   'long',
  year:    'numeric',
})

function dateKeyFor(iso: string) {
  return dayKeyFormat.format(new Date(iso))
}

function dateLabelFor(iso: string) {
  const key = dateKeyFor(iso)
  const now = Date.now()

  if (key === dayKeyFormat.format(new Date(now))) return 'Today'
  if (key === dayKeyFormat.format(new Date(now - 24 * 60 * 60 * 1000))) return 'Yesterday'
  return dayLongFormat.format(new Date(iso))
}

function addMessage(counts: DirectionCounts, messageType: string) {
  counts.total += 1
  if (messageType === 'text')  counts.text  += 1
  if (messageType === 'image') counts.image += 1
  if (messageType === 'voice') counts.voice += 1
  if (messageType === 'video') counts.video += 1
}

/**
 * Customer messages are counted in full for whichever rep worked that customer
 * that day — no attempt to pin them to whoever was on duty at the time. They
 * stay in their own bucket so a rep's own volume never absorbs them.
 */
function buildActivityRows(
  messages: MessageRow[],
  selectedAgentId: string
): SupportActivityRow[] {
  const map = new Map<string, SupportActivityRow>()

  for (const msg of messages) {
    const conv = msg.support_conversations
    if (!conv) continue

    const isSent = msg.sender_type === 'agent' && msg.sender_id === selectedAgentId
    const isCustomer = msg.sender_type === 'customer'
    if (!isSent && !isCustomer) continue

    const dateKey = dateKeyFor(msg.created_at)
    const key = `${dateKey}|${conv.tenant_id}`

    let row = map.get(key)
    if (!row) {
      row = {
        key,
        dateKey,
        dateLabel:  dateLabelFor(msg.created_at),
        tenantId:   conv.tenant_id,
        tenantName: conv.tenant_name,
        sent:       emptyCounts(),
        received:   emptyCounts(),
        lastAt:     msg.created_at,
      }
      map.set(key, row)
    }

    addMessage(isSent ? row.sent : row.received, msg.message_type)

    if (new Date(msg.created_at) > new Date(row.lastAt)) {
      row.lastAt = msg.created_at
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  )
}

function buildTimeDays(logs: TimeLogRow[]): SupportTimeDay[] {
  const now = Date.now()
  const map = new Map<string, SupportTimeDay>()

  for (const log of logs) {
    const clockInMs = new Date(log.clock_in).getTime()
    const clockOutMs = log.clock_out ? new Date(log.clock_out).getTime() : now
    const durationMs = Math.max(0, clockOutMs - clockInMs)
    const dateKey = dateKeyFor(log.clock_in)

    let day = map.get(dateKey)
    if (!day) {
      day = {
        dateKey,
        dateLabel:  dateLabelFor(log.clock_in),
        sessions:   [],
        durationMs: 0,
      }
      map.set(dateKey, day)
    }

    day.sessions.push({
      id:         log.id,
      clockIn:    log.clock_in,
      clockOut:   log.clock_out,
      durationMs,
    })
    day.durationMs += durationMs
  }

  for (const day of map.values()) {
    day.sessions.sort(
      (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime()
    )
  }

  return [...map.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

function parseRange(value: string | undefined): ActivityRange {
  if (value === '1d' || value === '7d' || value === '30d' || value === 'all') return value
  return '30d'
}

function startAtFor(range: ActivityRange) {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  if (range === '1d')  return new Date(now - day)
  if (range === '7d')  return new Date(now - 7 * day)
  if (range === '30d') return new Date(now - 30 * day)
  return null
}

export default async function SupportActivityPage({
  searchParams,
}: {
  searchParams: { rep?: string; range?: string }
}) {
  const supabase  = createClient()
  const profile   = await getCachedProfile()
  const canSeeAll = isCsManager(profile)

  const usersResult = canSeeAll
    ? await supabase
        .from('profiles')
        .select('id, full_name, email, roles')
        .not('roles', 'eq', '{}')
        .order('full_name')
    : await supabase
        .from('profiles')
        .select('id, full_name, email, roles')
        .eq('id', profile!.id)

  const agentUsers = (usersResult.data ?? []).filter(u =>
    (u.roles as string[] ?? []).some(r => String(r).startsWith('cs_'))
  )

  const selfIsAgent = agentUsers.some(u => u.id === profile?.id)

  const selectedAgentId =
    searchParams.rep && agentUsers.some(u => u.id === searchParams.rep)
      ? searchParams.rep
      : (selfIsAgent ? profile!.id : agentUsers[0]?.id) ?? profile?.id ?? ''

  const range = parseRange(searchParams.range)
  const startAt = startAtFor(range)

  const messages: MessageRow[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase
      .from('support_messages')
      .select(`
        sender_id,
        sender_type,
        message_type,
        created_at,
        support_conversations (
          tenant_id,
          tenant_name
        )
      `)
      // id breaks created_at ties so paging can't skip or repeat a row.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (startAt) query = query.gte('created_at', startAt.toISOString())

    const { data, error } = await query
    if (error || !data || data.length === 0) break

    messages.push(...(data as unknown as MessageRow[]))
    if (data.length < PAGE_SIZE) break
  }

  let timeQuery = supabase
    .from('support_time_logs')
    .select('id, clock_in, clock_out')
    .eq('agent_id', selectedAgentId)
    .order('clock_in', { ascending: false })
    .limit(2000)

  if (startAt) timeQuery = timeQuery.gte('clock_in', startAt.toISOString())

  const { data: timeData } = selectedAgentId
    ? await timeQuery
    : { data: [] as TimeLogRow[] }

  // A day/customer only belongs to this rep if they sent something that day.
  const rows = buildActivityRows(messages, selectedAgentId).filter(r => r.sent.total > 0)
  const timeDays = buildTimeDays((timeData ?? []) as TimeLogRow[])

  return (
    <div className={styles.page}>
      {agentUsers.length > 0 && (
        <div className={styles.topBar}>
          <RepSelector
            users={agentUsers}
            selectedId={selectedAgentId}
            basePath="/support/activity"
          />
        </div>
      )}

      <SupportActivityClient rows={rows} timeDays={timeDays} range={range} />
    </div>
  )
}
