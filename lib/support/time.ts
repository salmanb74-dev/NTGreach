export type TimeLog = {
  id:         string
  agent_id:   string
  clock_in:   string
  clock_out:  string | null
  notes:      string | null
  created_at: string
}

export type TimeAgent = {
  id:        string
  full_name: string | null
  email:     string
}

export function agentLabel(agent: Pick<TimeAgent, 'full_name' | 'email'>) {
  return agent.full_name?.trim() || agent.email || 'Agent'
}

/** Duration in ms; if still active, uses `now`. */
export function durationMs(
  clockIn: string,
  clockOut: string | null,
  now = Date.now()
): number {
  const start = new Date(clockIn).getTime()
  const end = clockOut ? new Date(clockOut).getTime() : now
  return Math.max(0, end - start)
}

export function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins.toString().padStart(2, '0')}m`
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export function formatClockDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-PK', {
    month: 'long',
    year:  'numeric',
  })
}

/** Inclusive UTC range covering a local calendar month. */
export function monthRangeUtc(year: number, month: number): {
  startIso: string
  endIso: string
} {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function totalHoursLabel(logs: TimeLog[], now = Date.now()): string {
  const ms = logs.reduce(
    (sum, log) => sum + durationMs(log.clock_in, log.clock_out, now),
    0
  )
  return formatDuration(ms)
}
