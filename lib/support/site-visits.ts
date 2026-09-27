export type SupportProduct = 'resto' | 'alma'

export type SiteVisit = {
  id:               string
  agent_id:         string
  product:          SupportProduct
  visit_date:       string // YYYY-MM-DD
  visit_time:       string // HH:MM or HH:MM:SS
  duration_minutes: number
  tenant_id:        string | null
  customer_name:    string
  notes:            string | null
  created_at:       string
  updated_at:       string
}

export type SiteVisitAgent = {
  id:        string
  full_name: string | null
  email:     string
}

export type SiteVisitCustomerOption = {
  tenant_id: string | null
  name:      string
}

export type SiteVisitInput = {
  product:          SupportProduct
  visit_date:       string
  visit_time:       string
  duration_minutes: number
  tenant_id?:       string | null
  customer_name:    string
  notes?:           string | null
}

export const DURATION_STEP_MINUTES = 15
/** Standard 15-min blocks up through 5 hours. */
export const DURATION_STANDARD_MAX_MINUTES = 5 * 60
/**
 * Extra long-visit bucket (>5 hr). Stored as minutes for payroll;
 * shown as a single ">5 hr" choice in the picker.
 */
export const DURATION_OVER_5HR_MINUTES = 5 * 60 + 15

export function agentLabel(agent: Pick<SiteVisitAgent, 'full_name' | 'email'>) {
  return agent.full_name?.trim() || agent.email || 'Agent'
}

export function durationOptions(): number[] {
  const options: number[] = []
  for (
    let m = DURATION_STEP_MINUTES;
    m <= DURATION_STANDARD_MAX_MINUTES;
    m += DURATION_STEP_MINUTES
  ) {
    options.push(m)
  }
  options.push(DURATION_OVER_5HR_MINUTES)
  return options
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  if (h === 0) return `${m} min`
  if (m === 0) return h === 1 ? '1 hr' : `${h} hr`
  return `${h} hr ${m} min`
}

/** Label for the duration dropdown (includes the ">5 hr" bucket). */
export function formatDurationOption(minutes: number): string {
  if (minutes === DURATION_OVER_5HR_MINUTES) return '>5 hr'
  return formatDurationMinutes(minutes)
}

/** Table/display label for a single visit’s duration. */
export function formatVisitDuration(minutes: number): string {
  if (minutes >= DURATION_OVER_5HR_MINUTES) return '>5 hr'
  return formatDurationMinutes(minutes)
}

export function formatVisitDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-PK', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}

export function formatVisitTime(time: string): string {
  const parts = time.split(':')
  const hh = Number(parts[0] ?? 0)
  const mm = Number(parts[1] ?? 0)
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.toLocaleTimeString('en-PK', {
    hour:   'numeric',
    minute: '2-digit',
  })
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-PK', {
    month: 'long',
    year:  'numeric',
  })
}

/** Inclusive local calendar month → date strings for filtering visit_date. */
export function monthDateRange(year: number, month: number): {
  startYmd: string
  endYmd: string
} {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return {
    startYmd: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endYmd:   `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  }
}

export function normalizeVisitTime(time: string): string {
  const trimmed = time.trim()
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (!match) throw new Error('Invalid time')
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error('Invalid time')
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`
}

export function normalizeVisitDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) throw new Error('Invalid date')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const d = new Date(year, month - 1, day)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    throw new Error('Invalid date')
  }
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function assertDurationMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value % DURATION_STEP_MINUTES !== 0) {
    throw new Error(`Duration must be a multiple of ${DURATION_STEP_MINUTES} minutes`)
  }
  if (
    value > DURATION_STANDARD_MAX_MINUTES &&
    value !== DURATION_OVER_5HR_MINUTES
  ) {
    throw new Error('Invalid duration')
  }
  return value
}

/** Map any stored minutes into a valid picker value (incl. legacy >5hr rows). */
export function coerceDurationMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 60
  const snapped = Math.round(value / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES
  if (snapped > DURATION_STANDARD_MAX_MINUTES) return DURATION_OVER_5HR_MINUTES
  return Math.max(DURATION_STEP_MINUTES, snapped)
}

export function totalMinutesLabel(visits: SiteVisit[]): string {
  const total = visits.reduce((sum, v) => sum + v.duration_minutes, 0)
  return formatDurationMinutes(total)
}

export function toTimeInputValue(time: string): string {
  const parts = time.split(':')
  const hh = (parts[0] ?? '00').padStart(2, '0')
  const mm = (parts[1] ?? '00').padStart(2, '0')
  return `${hh}:${mm}`
}
