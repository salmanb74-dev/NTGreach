import type { ActivityType } from '@/lib/types'

export type ActivityBreakdownItem = {
  key: ActivityType
  label: string
  value: number
  color: string
}

export type MonthColumn = {
  key: string
  label: string
}

export type SixMonthActivityRow = {
  key: ActivityType
  label: string
  color: string
  months: number[]
  total: number
}

export type SixMonthActivityBreakdown = {
  columns: MonthColumn[]
  rows: SixMonthActivityRow[]
}

/** Display order and colours for dashboard activity breakdown. */
export const DASHBOARD_ACTIVITY_SERIES: {
  key: ActivityType
  label: string
  color: string
}[] = [
  { key: 'email_outbound', label: 'Emails sent', color: 'var(--color-info)' },
  { key: 'email_inbound', label: 'Emails received', color: '#6366f1' },
  { key: 'whatsapp_log', label: 'WhatsApp', color: 'var(--color-success)' },
  { key: 'call', label: 'Calls', color: 'var(--color-warning)' },
  { key: 'meeting', label: 'Meetings', color: 'var(--color-primary)' },
  { key: 'site_visit', label: 'Site visits', color: '#0ea5e9' },
  { key: 'note', label: 'Notes', color: 'var(--color-text-3)' },
]

const SERIES_KEYS = new Set(DASHBOARD_ACTIVITY_SERIES.map(s => s.key))

export function getLastSixMonthColumns(refDate = new Date()): MonthColumn[] {
  const columns: MonthColumn[] = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - offset, 1)
    columns.push({
      key: monthKeyFromDate(d),
      label: d.toLocaleString('en-US', { month: 'short' }),
    })
  }
  return columns
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyFromIso(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return monthKeyFromDate(d)
}

function sixMonthWindow(refDate = new Date()) {
  const start = new Date(refDate.getFullYear(), refDate.getMonth() - 5, 1)
  const end = new Date(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  )
  return { start, end }
}

function isWithinWindow(iso: string, start: Date, end: Date): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d >= start && d <= end
}

export function buildSixMonthActivityBreakdown(
  activities: { type: string; lead_id: string; created_at: string }[],
  leadIds: Set<string>,
  meetings: { lead_id: string; created_at: string }[] = [],
  refDate = new Date()
): SixMonthActivityBreakdown {
  const columns = getLastSixMonthColumns(refDate)
  const columnIndex = new Map(columns.map((c, i) => [c.key, i]))
  const { start, end } = sixMonthWindow(refDate)

  const monthCounts: Record<string, number[]> = {}
  for (const { key } of DASHBOARD_ACTIVITY_SERIES) {
    monthCounts[key] = columns.map(() => 0)
  }

  for (const activity of activities) {
    if (!leadIds.has(activity.lead_id)) continue
    if (!SERIES_KEYS.has(activity.type as ActivityType)) continue
    if (activity.type === 'meeting') continue
    if (!isWithinWindow(activity.created_at, start, end)) continue
    const mk = monthKeyFromIso(activity.created_at)
    const idx = mk != null ? columnIndex.get(mk) : undefined
    if (idx == null) continue
    monthCounts[activity.type][idx] += 1
  }

  for (const meeting of meetings) {
    if (!leadIds.has(meeting.lead_id)) continue
    if (!isWithinWindow(meeting.created_at, start, end)) continue
    const mk = monthKeyFromIso(meeting.created_at)
    const idx = mk != null ? columnIndex.get(mk) : undefined
    if (idx == null) continue
    monthCounts.meeting[idx] += 1
  }

  const rows: SixMonthActivityRow[] = DASHBOARD_ACTIVITY_SERIES.map(
    ({ key, label, color }) => {
      const months = monthCounts[key]
      const total = months.reduce((sum, n) => sum + n, 0)
      return { key, label, color, months, total }
    }
  )

  return { columns, rows }
}

export function breakdownRowsForChart(rows: SixMonthActivityRow[]): ActivityBreakdownItem[] {
  return rows.map(({ key, label, color, total }) => ({
    key,
    label,
    value: total,
    color,
  }))
}
