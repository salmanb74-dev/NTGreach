export type ShiftAgent = {
  id:        string
  full_name: string | null
  email:     string
  roles:     string[]
}

export type ShiftItem = {
  id:         string
  agent_id:   string
  agent_name: string
  start_at:   string
  end_at:     string
  created_by: string
  created_at: string
  series_id:  string | null
}

export type OnDutyAgent = {
  shift_id:   string
  agent_id:   string
  agent_name: string
  start_at:   string
  end_at:     string
}

export const DEFAULT_OFFLINE_MESSAGE =
  'Our support team is currently offline. We will get back to you as soon as possible.'

export function agentDisplayName(agent: Pick<ShiftAgent, 'full_name' | 'email'>) {
  return agent.full_name?.trim() || agent.email || 'Agent'
}

/** Monday 00:00:00 local for the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const yOpts: Intl.DateTimeFormatOptions = { ...opts, year: 'numeric' }
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()
  const left = weekStart.toLocaleDateString('en-PK', sameYear ? opts : yOpts)
  const right = weekEnd.toLocaleDateString('en-PK', yOpts)
  return `${left} – ${right}`
}

export function formatShiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export function formatShiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}

/** Stable pastel color class index 0–5 from agent id. */
export function agentColorIndex(agentId: string): number {
  let hash = 0
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0
  }
  return hash % 6
}

/** Shifts that intersect a local calendar day (00:00–24:00). */
export function shiftsForDay(shifts: ShiftItem[], day: Date): ShiftItem[] {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(23, 59, 59, 999)

  return shifts
    .filter(s => {
      const start = new Date(s.start_at)
      const end = new Date(s.end_at)
      return start <= dayEnd && end >= dayStart
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Position a shift within a day's 24h column (0–100%).
 * Clips overnight spans to the visible day.
 */
export function shiftPositionInDay(
  shift: ShiftItem,
  day: Date
): { topPct: number; heightPct: number } | null {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEndMs = dayStart.getTime() + MS_PER_DAY

  const startMs = Math.max(new Date(shift.start_at).getTime(), dayStart.getTime())
  const endMs = Math.min(new Date(shift.end_at).getTime(), dayEndMs)
  if (endMs <= startMs) return null

  const topPct = ((startMs - dayStart.getTime()) / MS_PER_DAY) * 100
  // Minimum ~15 min visual height so short shifts stay clickable
  const heightPct = Math.max(((endMs - startMs) / MS_PER_DAY) * 100, 100 / 96)
  return { topPct, heightPct }
}

/** Current time as % down the day column (null if not this local day). */
export function nowPositionInDay(day: Date, now = new Date()): number | null {
  if (!sameDay(day, now)) return null
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const pct = ((now.getTime() - dayStart.getTime()) / MS_PER_DAY) * 100
  return Math.min(100, Math.max(0, pct))
}

export function formatHourLabel(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toLocaleTimeString('en-PK', { hour: 'numeric' })
}

/** True if two intervals overlap (for same-agent warning). */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = new Date(aStart).getTime()
  const ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime()
  const be = new Date(bEnd).getTime()
  return as < be && bs < ae
}

/** Local YYYY-MM-DD for a Date. */
export function toLocalDateString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Build start/end ISO for a local calendar day + times.
 * If endTime <= startTime, the shift ends the next calendar day (overnight).
 */
export function buildShiftInterval(
  dateYmd: string,
  startTime: string,
  endTime: string
): { startAt: string; endAt: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return null

  const start = new Date(`${dateYmd}T${startTime}:00`)
  if (Number.isNaN(start.getTime())) return null

  const overnight = endTime <= startTime
  const endDate = overnight
    ? addDays(new Date(`${dateYmd}T12:00:00`), 1)
    : new Date(`${dateYmd}T12:00:00`)
  const endYmd = toLocalDateString(endDate)
  const end = new Date(`${endYmd}T${endTime}:00`)
  if (Number.isNaN(end.getTime())) return null
  if (end <= start) return null

  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'T' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'T' },
  { value: 5, label: 'Fri', short: 'F' },
  { value: 6, label: 'Sat', short: 'S' },
  { value: 0, label: 'Sun', short: 'S' },
] as const

export type ExpandRecurringShiftsInput = {
  rangeStartYmd: string
  rangeEndYmd:   string
  weekdays:      number[] // 0=Sun … 6=Sat (JS getDay)
  startTime:     string   // HH:mm
  endTime:       string   // HH:mm
  /** Safety cap (default 400). */
  maxOccurrences?: number
}

/**
 * Expand a weekly recurring pattern into concrete shift intervals.
 * Inclusive of rangeStartYmd and rangeEndYmd (by start day).
 */
export function expandRecurringShifts(
  input: ExpandRecurringShiftsInput
): { startAt: string; endAt: string }[] {
  const {
    rangeStartYmd,
    rangeEndYmd,
    weekdays,
    startTime,
    endTime,
    maxOccurrences = 400,
  } = input

  const uniqueDays = [...new Set(weekdays)].filter(d => d >= 0 && d <= 6)
  if (uniqueDays.length === 0) return []

  const start = new Date(`${rangeStartYmd}T12:00:00`)
  const end = new Date(`${rangeEndYmd}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  if (end < start) return []

  const out: { startAt: string; endAt: string }[] = []
  const cursor = new Date(start)

  while (cursor <= end && out.length < maxOccurrences) {
    if (uniqueDays.includes(cursor.getDay())) {
      const interval = buildShiftInterval(toLocalDateString(cursor), startTime, endTime)
      if (interval) out.push(interval)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return out
}

/** Clock-time pattern key (UTC) so series created the same way match on server + client. */
export function shiftTimePatternKey(startAt: string, endAt: string): string {
  const s = new Date(startAt)
  const e = new Date(endAt)
  const fmt = (d: Date) =>
    `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
  return `${fmt(s)}→${fmt(e)}`
}

export type LaidOutShift = {
  shift:      ShiftItem
  topPct:     number
  heightPct:  number
  col:        number
  colCount:   number
  overlaps:   boolean
}

/**
 * Lay out shifts in a day column so overlapping agents sit side-by-side.
 */
export function layoutShiftsForDay(shifts: ShiftItem[], day: Date): LaidOutShift[] {
  const positioned = shifts
    .map(shift => {
      const pos = shiftPositionInDay(shift, day)
      if (!pos) return null
      return {
        shift,
        topPct:    pos.topPct,
        heightPct: pos.heightPct,
        startMs:   Math.max(new Date(shift.start_at).getTime(), (() => {
          const d = new Date(day); d.setHours(0, 0, 0, 0); return d.getTime()
        })()),
        endMs: Math.min(new Date(shift.end_at).getTime(), (() => {
          const d = new Date(day); d.setHours(0, 0, 0, 0); return d.getTime() + MS_PER_DAY
        })()),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs)

  const laneEnd: number[] = []
  const laneOf = new Map<string, number>()

  for (const item of positioned) {
    let lane = laneEnd.findIndex(end => end <= item.startMs)
    if (lane === -1) {
      lane = laneEnd.length
      laneEnd.push(item.endMs)
    } else {
      laneEnd[lane] = item.endMs
    }
    laneOf.set(item.shift.id, lane)
  }

  return positioned.map(item => {
    const col = laneOf.get(item.shift.id) ?? 0
    // How many lanes are active during this shift's span
    let colCount = 1
    for (const other of positioned) {
      if (other.shift.id === item.shift.id) continue
      if (other.startMs < item.endMs && item.startMs < other.endMs) {
        colCount = Math.max(
          colCount,
          (laneOf.get(other.shift.id) ?? 0) + 1,
          col + 1
        )
      }
    }
    // Use global max lanes in the overlapping cluster for even widths
    const clusterLanes = new Set<number>([col])
    for (const other of positioned) {
      if (other.startMs < item.endMs && item.startMs < other.endMs) {
        clusterLanes.add(laneOf.get(other.shift.id) ?? 0)
      }
    }
    const clusterCount = Math.max(...clusterLanes) + 1

    return {
      shift:     item.shift,
      topPct:    item.topPct,
      heightPct: item.heightPct,
      col,
      colCount:  clusterCount,
      overlaps:  clusterCount > 1,
    }
  })
}

/** Other shifts that overlap this one in time (any agent). */
export function findOverlappingShifts(
  shift: ShiftItem,
  all: ShiftItem[]
): ShiftItem[] {
  return all.filter(
    s =>
      s.id !== shift.id &&
      intervalsOverlap(shift.start_at, shift.end_at, s.start_at, s.end_at)
  )
}
