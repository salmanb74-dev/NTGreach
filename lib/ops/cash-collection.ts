/**
 * Ops cash collection — schedule math + shared types.
 * Expected due rows live in Reach; schedule is driven by enterprise subscription.
 */

export type CashProduct = 'resto' | 'alma'
export type CashCollectionKind =
  | 'setup'
  | 'setup_pre_trial'
  | 'recurring'
  | 'other'
export type CashCollectionStatus = 'due' | 'partial' | 'collected'

export type OpsCashTenant = {
  id: string
  tenant_id: string
  product: CashProduct
  enabled: boolean
  currency: string
  schedule_anchor: string | null
  cycle_months: number
  default_setup_amount: number | null
  default_pre_trial_setup_amount: number | null
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
  expected_amount: number
  amount_collected: number
  currency: string
  due_date: string
  collected_on: string | null
  status: CashCollectionStatus
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
  /** Expected amount on the next unpaid row. */
  nextExpectedAmount: number | null
  /** Collected so far on the next unpaid row. */
  nextAmountCollected: number | null
  /** Row id for the next unpaid charge. */
  nextRowId: string | null
}

export type ExpectedDueSpec = {
  kind: CashCollectionKind
  dueDate: string
  expectedAmount: number
}

export type CashScheduleDefaults = {
  scheduleAnchor: string | null
  cycleMonths: number
  defaultSetupAmount: number | null
  defaultPreTrialSetupAmount: number | null
  defaultRecurringAmount: number | null
  currency: string
  /** True when subscription has enterprise cash terms to sync. */
  isEnterprise: boolean
}

const DUE_SOON_DAYS = 7
const NOTE_MAX_WORDS = 5

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

export function collectionStatusFromAmounts(
  expectedAmount: number,
  amountCollected: number
): CashCollectionStatus {
  if (!(amountCollected > 0)) return 'due'
  if (amountCollected + 1e-9 < expectedAmount) return 'partial'
  return 'collected'
}

export function isUnpaidStatus(status: CashCollectionStatus): boolean {
  return status === 'due' || status === 'partial'
}

/** Cap notes to a short phrase (default 5 words). */
export function normalizeCashNote(
  notes: string | null | undefined,
  maxWords = NOTE_MAX_WORDS
): string | null {
  if (notes == null) return null
  const trimmed = notes.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const words = trimmed.split(' ')
  if (words.length <= maxWords) return trimmed
  return words.slice(0, maxWords).join(' ')
}

/**
 * Build expected due specs: setup fees (if > 0) + all past/today recurring
 * cycles + one future recurring cycle.
 */
export function generateExpectedDueSpecs(opts: {
  scheduleAnchor: string | null
  cycleMonths: number
  recurringAmount: number | null
  setupAmount: number | null
  preTrialSetupAmount: number | null
  today?: string
  maxSteps?: number
}): ExpectedDueSpec[] {
  const today = opts.today ?? todayISO()
  const specs: ExpectedDueSpec[] = []
  if (!opts.scheduleAnchor) return specs
  const anchor = opts.scheduleAnchor.slice(0, 10)

  if (opts.setupAmount != null && opts.setupAmount > 0) {
    specs.push({
      kind: 'setup',
      dueDate: anchor,
      expectedAmount: opts.setupAmount,
    })
  }
  if (opts.preTrialSetupAmount != null && opts.preTrialSetupAmount > 0) {
    specs.push({
      kind: 'setup_pre_trial',
      dueDate: anchor,
      expectedAmount: opts.preTrialSetupAmount,
    })
  }

  if (opts.recurringAmount != null && opts.recurringAmount > 0) {
    const cycle = Math.max(1, Math.floor(opts.cycleMonths) || 1)
    const maxSteps = opts.maxSteps ?? 600
    let cursor = anchor
    for (let i = 0; i < maxSteps; i++) {
      if (cursor <= today) {
        specs.push({
          kind: 'recurring',
          dueDate: cursor,
          expectedAmount: opts.recurringAmount,
        })
        cursor = addMonthsISO(cursor, cycle)
        continue
      }
      // One future cycle beyond today
      specs.push({
        kind: 'recurring',
        dueDate: cursor,
        expectedAmount: opts.recurringAmount,
      })
      break
    }
  }

  return specs
}

export function computeCashDueStatusFromRows(
  rows: Array<{
    id: string
    kind: CashCollectionKind
    due_date: string
    status: CashCollectionStatus
    expected_amount: number
    amount_collected: number
  }>,
  today = todayISO(),
  soonDays = DUE_SOON_DAYS
): CashDueStatus {
  const unpaid = rows.filter(r => isUnpaidStatus(r.status))
  if (unpaid.length === 0) {
    return {
      nextDue: null,
      overdue: false,
      dueSoon: false,
      nextKind: null,
      nextExpectedAmount: null,
      nextAmountCollected: null,
      nextRowId: null,
    }
  }

  unpaid.sort((a, b) => {
    const da = a.due_date.slice(0, 10)
    const db = b.due_date.slice(0, 10)
    if (da !== db) return da < db ? -1 : 1
    return kindPriority(a.kind) - kindPriority(b.kind)
  })

  const next = unpaid[0]!
  const due = next.due_date.slice(0, 10)
  const delta = daysBetweenISO(today, due)
  return {
    nextDue: due,
    overdue: delta < 0,
    dueSoon: delta <= soonDays,
    nextKind: next.kind,
    nextExpectedAmount: next.expected_amount,
    nextAmountCollected: next.amount_collected,
    nextRowId: next.id,
  }
}

function kindPriority(kind: CashCollectionKind): number {
  if (kind === 'setup_pre_trial') return 0
  if (kind === 'setup') return 1
  if (kind === 'recurring') return 2
  return 3
}

/** @deprecated Prefer computeCashDueStatusFromRows with stored expected dues. */
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
    const paid = new Set(
      [...opts.recurringPaidDueDates].map(s => s.slice(0, 10))
    )
    const cycle = Math.max(1, Math.floor(opts.cycleMonths) || 1)
    let cursor = anchor
    for (let i = 0; i < 600; i++) {
      if (!paid.has(cursor)) {
        candidates.push({ due: cursor, kind: 'recurring' })
        break
      }
      cursor = addMonthsISO(cursor, cycle)
    }
  }

  if (candidates.length === 0) {
    return {
      nextDue: null,
      overdue: false,
      dueSoon: false,
      nextKind: null,
      nextExpectedAmount: null,
      nextAmountCollected: null,
      nextRowId: null,
    }
  }

  candidates.sort((a, b) => {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1
    return kindPriority(a.kind) - kindPriority(b.kind)
  })

  const next = candidates[0]!
  const delta = daysBetweenISO(today, next.due)
  return {
    nextDue: next.due,
    overdue: delta < 0,
    dueSoon: delta <= soonDays,
    nextKind: next.kind,
    nextExpectedAmount: null,
    nextAmountCollected: null,
    nextRowId: null,
  }
}

/** Pull cash defaults from a Nest subscription snapshot (enterprise only). */
export function cashDefaultsFromSubscription(
  sub: Record<string, unknown> | null | undefined
): CashScheduleDefaults {
  if (!sub) {
    return {
      scheduleAnchor: null,
      cycleMonths: 1,
      defaultSetupAmount: null,
      defaultPreTrialSetupAmount: null,
      defaultRecurringAmount: null,
      currency: 'USD',
      isEnterprise: false,
    }
  }

  const access =
    str(sub.enterpriseAccessStartsAt) ??
    str(sub.enterprise_access_starts_at) ??
    str(sub.currentPeriodStart) ??
    str(sub.current_period_start) ??
    str(sub.firstSubscriptionStartDate) ??
    str(sub.first_subscription_start_date)

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
  else if (billingCycle === '3_month' || billingCycle === 'quarterly')
    cycleMonths = 3
  else if (billingCycle === '1_year') cycleMonths = 12
  else cycleMonths = 1

  const defaultRecurringAmount =
    livePrice != null && livePrice > 0
      ? livePrice
      : offerPrice != null && offerPrice > 0
        ? offerPrice
        : null

  const enterpriseSetup = num(
    sub.enterpriseSetupFee ?? sub.enterprise_setup_fee
  )
  const preTrialSetup = num(
    sub.enterprisePreTrialSetupFee ?? sub.enterprise_pre_trial_setup_fee
  )

  const defaultSetupAmount =
    enterpriseSetup != null && enterpriseSetup > 0 ? enterpriseSetup : null
  const defaultPreTrialSetupAmount =
    preTrialSetup != null && preTrialSetup > 0 ? preTrialSetup : null

  const isEnterprise =
    (livePrice != null && livePrice > 0) ||
    (offerPrice != null && offerPrice > 0) ||
    (liveDuration != null && liveDuration > 0) ||
    (offerDuration != null && offerDuration > 0) ||
    defaultSetupAmount != null ||
    defaultPreTrialSetupAmount != null

  return {
    scheduleAnchor: isEnterprise ? scheduleAnchor : null,
    cycleMonths,
    defaultSetupAmount: isEnterprise ? defaultSetupAmount : null,
    defaultPreTrialSetupAmount: isEnterprise
      ? defaultPreTrialSetupAmount
      : null,
    defaultRecurringAmount: isEnterprise ? defaultRecurringAmount : null,
    currency: 'USD',
    isEnterprise,
  }
}

/** True when tenant cash defaults diverge from subscription enterprise terms. */
export function cashDefaultsDiffer(
  settings: Pick<
    OpsCashTenant,
    | 'schedule_anchor'
    | 'cycle_months'
    | 'default_setup_amount'
    | 'default_pre_trial_setup_amount'
    | 'default_recurring_amount'
  > | null,
  defaults: CashScheduleDefaults
): boolean {
  if (!settings || !defaults.isEnterprise) return false
  if ((settings.schedule_anchor ?? null) !== (defaults.scheduleAnchor ?? null))
    return true
  if ((settings.cycle_months || 1) !== (defaults.cycleMonths || 1)) return true
  if (!numsEqual(settings.default_setup_amount, defaults.defaultSetupAmount))
    return true
  if (
    !numsEqual(
      settings.default_pre_trial_setup_amount,
      defaults.defaultPreTrialSetupAmount
    )
  )
    return true
  if (
    !numsEqual(
      settings.default_recurring_amount,
      defaults.defaultRecurringAmount
    )
  )
    return true
  return false
}

function numsEqual(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 1e-9
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

export const CASH_KIND_LABEL: Record<CashCollectionKind, string> = {
  setup: 'Setup',
  setup_pre_trial: 'Pre-trial setup',
  recurring: 'Recurring',
  other: 'Other',
}

export const CASH_STATUS_LABEL: Record<CashCollectionStatus, string> = {
  due: 'Due',
  partial: 'Partial',
  collected: 'Collected',
}
