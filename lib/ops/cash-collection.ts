/**
 * Ops cash collection — schedule math + shared types.
 * Collections live in Reach; schedule is driven by subscription anchor + cycle.
 */

export type CashProduct = 'resto' | 'alma'
export type CashCollectionKind = 'setup' | 'recurring' | 'other'

export type OpsCashTenant = {
  id: string
  tenant_id: string
  product: CashProduct
  enabled: boolean
  currency: string
  schedule_anchor: string | null
  cycle_months: number
  default_setup_amount: number | null
  default_recurring_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type OpsCashCollection = {
  id: string
  tenant_id: string
  product: CashProduct
  kind: CashCollectionKind
  amount: number
  currency: string
  due_date: string
  collected_on: string
  notes: string | null
  collected_by: string | null
  created_at: string
  updated_at: string
}

export type CashDueStatus = {
  /** Earliest unpaid scheduled charge (setup or recurring). */
  nextDue: string | null
  /** True when nextDue is before today. */
  overdue: boolean
  /** True when nextDue is today or within `soonDays` (includes overdue). */
  dueSoon: boolean
  /** Kind associated with nextDue (setup preferred when both due same day). */
  nextKind: CashCollectionKind | null
}

const DUE_SOON_DAYS = 7

export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse YYYY-MM-DD as a local calendar date (no TZ shift). */
export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

export function formatISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Add calendar months; clamps day when target month is shorter. */
export function addMonthsISO(iso: string, months: number): string {
  const { y, m, d } = parseISODate(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const dim = daysInMonth(ny, nm)
  return formatISODate(ny, nm, Math.min(d, dim))
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/** Signed day difference: b - a (both YYYY-MM-DD). */
export function daysBetweenISO(a: string, b: string): number {
  const A = parseISODate(a)
  const B = parseISODate(b)
  const t0 = Date.UTC(A.y, A.m - 1, A.d)
  const t1 = Date.UTC(B.y, B.m - 1, B.d)
  return Math.round((t1 - t0) / 86_400_000)
}

/**
 * Next unpaid recurring anniversary on the schedule.
 * Due dates are independent of when cash was actually collected.
 */
export function nextRecurringDueDate(opts: {
  scheduleAnchor: string
  cycleMonths: number
  paidDueDates: Iterable<string>
  /** Walk at most this many cycles (safety). */
  maxSteps?: number
}): string | null {
  const paid = new Set(
    [...opts.paidDueDates].map(s => s.slice(0, 10))
  )
  const cycle = Math.max(1, Math.floor(opts.cycleMonths) || 1)
  const maxSteps = opts.maxSteps ?? 600
  let cursor = opts.scheduleAnchor.slice(0, 10)
  for (let i = 0; i < maxSteps; i++) {
    if (!paid.has(cursor)) return cursor
    cursor = addMonthsISO(cursor, cycle)
  }
  return null
}

export function computeCashDueStatus(opts: {
  scheduleAnchor: string | null
  cycleMonths: number
  setupCollected: boolean
  recurringPaidDueDates: Iterable<string>
  today?: string
  soonDays?: number
}): CashDueStatus {
  const today = opts.today ?? todayISO()
  const soonDays = opts.soonDays ?? DUE_SOON_DAYS
  const candidates: { due: string; kind: CashCollectionKind }[] = []

  if (opts.scheduleAnchor) {
    const anchor = opts.scheduleAnchor.slice(0, 10)
    if (!opts.setupCollected) {
      candidates.push({ due: anchor, kind: 'setup' })
    }
    const nextRecurring = nextRecurringDueDate({
      scheduleAnchor: anchor,
      cycleMonths: opts.cycleMonths,
      paidDueDates: opts.recurringPaidDueDates,
    })
    if (nextRecurring) {
      candidates.push({ due: nextRecurring, kind: 'recurring' })
    }
  }

  if (candidates.length === 0) {
    return { nextDue: null, overdue: false, dueSoon: false, nextKind: null }
  }

  candidates.sort((a, b) => {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1
    // Same day: surface setup first
    if (a.kind === 'setup' && b.kind !== 'setup') return -1
    if (b.kind === 'setup' && a.kind !== 'setup') return 1
    return 0
  })

  const next = candidates[0]!
  const delta = daysBetweenISO(today, next.due)
  return {
    nextDue: next.due,
    overdue: delta < 0,
    dueSoon: delta <= soonDays,
    nextKind: next.kind,
  }
}

export type CashScheduleDefaults = {
  scheduleAnchor: string | null
  cycleMonths: number
  defaultSetupAmount: number | null
  defaultRecurringAmount: number | null
  currency: string
}

/** Pull cash defaults from a Nest subscription snapshot (loose shape). */
export function cashDefaultsFromSubscription(
  sub: Record<string, unknown> | null | undefined
): CashScheduleDefaults {
  if (!sub) {
    return {
      scheduleAnchor: null,
      cycleMonths: 1,
      defaultSetupAmount: null,
      defaultRecurringAmount: null,
      currency: 'USD',
    }
  }

  const access =
    str(sub.enterpriseAccessStartsAt) ??
    str(sub.enterprise_access_starts_at) ??
    str(sub.currentPeriodStart) ??
    str(sub.current_period_start)

  const scheduleAnchor = access ? access.slice(0, 10) : null

  const livePrice = num(sub.currentEnterprisePrice ?? sub.current_enterprise_price)
  const liveDuration = num(
    sub.currentEnterpriseDurationMonths ?? sub.current_enterprise_duration_months
  )
  const offerPrice = num(sub.enterprisePrice ?? sub.enterprise_price)
  const offerDuration = num(
    sub.enterpriseDurationMonths ?? sub.enterprise_duration_months
  )
  const billingCycle = (
    str(sub.billingCycle) ??
    str(sub.billing_cycle) ??
    'monthly'
  ).toLowerCase()

  let cycleMonths = 1
  if (liveDuration != null && liveDuration > 0) cycleMonths = Math.floor(liveDuration)
  else if (offerDuration != null && offerDuration > 0)
    cycleMonths = Math.floor(offerDuration)
  else if (billingCycle === 'yearly' || billingCycle === 'annual') cycleMonths = 12
  else if (billingCycle === 'biannual' || billingCycle === 'semi_annual')
    cycleMonths = 6
  else cycleMonths = 1

  const defaultRecurringAmount =
    livePrice != null && livePrice > 0
      ? livePrice
      : offerPrice != null && offerPrice > 0
        ? offerPrice
        : null

  const setup =
    num(sub.enterpriseSetupFee ?? sub.enterprise_setup_fee) ??
    num(sub.enterprisePostTrialSetupFee ?? sub.enterprise_post_trial_setup_fee) ??
    num(sub.enterprisePreTrialSetupFee ?? sub.enterprise_pre_trial_setup_fee)

  return {
    scheduleAnchor,
    cycleMonths,
    defaultSetupAmount: setup != null && setup >= 0 ? setup : null,
    defaultRecurringAmount,
    currency: 'USD',
  }
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDueLabel(status: CashDueStatus, today = todayISO()): string {
  if (!status.nextDue) return '—'
  const delta = daysBetweenISO(today, status.nextDue)
  if (delta < 0) {
    const n = Math.abs(delta)
    return `${status.nextDue} (${n}d overdue)`
  }
  if (delta === 0) return `${status.nextDue} (today)`
  if (delta <= 7) return `${status.nextDue} (${delta}d)`
  return status.nextDue
}
