import type {
  RestoEnterpriseOfferInput,
  RestoSubscriptionSnapshot,
} from '@/lib/resto-admin/types'
import {
  activePlanToOfferSeed,
  normalizePlanBaseId,
  resolveActivePlanView,
  type ActivePlanView,
  type LimitValue,
} from '@/lib/resto-admin/plan-catalog'
import { formatWhen } from '@/lib/format-when'
import { formatMoney as fmtMoney } from '@/lib/currency'

/** Duration = billing cycle length (months → UI label). */
export const DURATION_CYCLES = [
  { months: 1, label: '1 mo' },
  { months: 3, label: '3 mo' },
  { months: 6, label: '6 mo' },
  { months: 12, label: '1 yr' },
  { months: 24, label: '2 yr' },
] as const

export type OfferMode = 'trial' | 'subscription'

export type FormState = {
  monthlyPrice: string
  durationMonths: string
  setupFee: string
  locations: string
  locationsUnlimited: boolean
  users: string
  usersUnlimited: boolean
  counters: string
  countersUnlimited: boolean
  ordersPerMonth: string
  ordersUnlimited: boolean
  callCenter: boolean
  callCenterFee: string
  kds: boolean
  kdsFee: string
  inventory: boolean
  inventoryFee: string
  support: boolean
  supportFee: string
  webOrdering: boolean
  webOrderingFee: string
  webOrderingRevenuePercent: string
  /** Trial vs Subscription offer mode (maps to Nest paidTrial). */
  paidTrial: boolean
  /** Kept for Nest payload; UI no longer collects trial days. */
  paidTrialDays: string
  preTrialSetupFee: string
  postTrialSetupFee: string
  /** Subscription start (Nest accessStartsAt); optional on trial, required on sub. */
  accessStartsAt: string
  accessStartsEmpty: boolean
  /** Trial start (Nest trialStartsAt); required on trial; disabled on sub. */
  trialStartsAt: string
  trialStartsEmpty: boolean
  /**
   * Subscription-only backdated billing (Nest prorateBackdatedAccess).
   * Form always holds true|false; PUT sends null on trial.
   */
  prorateBackdatedAccess: boolean
  /** Reach-only ops notes (not sent to Nest). */
  offerNotes: string
}

export function offerModeFromForm(form: Pick<FormState, 'paidTrial'>): OfferMode {
  return form.paidTrial ? 'trial' : 'subscription'
}

export function durationCycleLabel(
  months: number | null | undefined
): string {
  if (months == null || !Number.isFinite(months)) return '—'
  const hit = DURATION_CYCLES.find(c => c.months === months)
  return hit ? hit.label : `${months} mo`
}

function boolFromApi(v: boolean | null | undefined): boolean {
  return v === true
}

function totalToMonthly(
  total: number | null | undefined,
  durationMonths: number
): number {
  const months = durationMonths > 0 ? durationMonths : 1
  if (total == null || !Number.isFinite(total)) return 0
  return total / months
}

function snapDurationMonths(months: number): number {
  if (DURATION_CYCLES.some(c => c.months === months)) return months
  let best: number = DURATION_CYCLES[0].months
  let bestDist = Math.abs(months - best)
  for (const c of DURATION_CYCLES) {
    const d = Math.abs(months - c.months)
    if (d < bestDist) {
      best = c.months
      bestDist = d
    }
  }
  return best
}

export function offerToForm(offer: RestoEnterpriseOfferInput): FormState {
  const durationMonths = snapDurationMonths(
    offer.durationMonths > 0 ? offer.durationMonths : 12
  )
  const monthly = totalToMonthly(offer.price, durationMonths)
  return {
    monthlyPrice: String(monthly),
    durationMonths: String(durationMonths),
    setupFee: String(offer.setupFee ?? 0),
    locations: offer.locations == null ? '' : String(offer.locations),
    locationsUnlimited: offer.locations == null,
    users: offer.users == null ? '' : String(offer.users),
    usersUnlimited: offer.users == null,
    counters: offer.counters == null ? '' : String(offer.counters),
    countersUnlimited: offer.counters == null,
    ordersPerMonth:
      offer.ordersPerMonth == null ? '' : String(offer.ordersPerMonth),
    ordersUnlimited: offer.ordersPerMonth == null,
    callCenter: boolFromApi(offer.callCenter),
    callCenterFee: '',
    kds: boolFromApi(offer.kds),
    kdsFee: '',
    inventory: boolFromApi(offer.inventory),
    inventoryFee: '',
    support: boolFromApi(offer.support),
    supportFee: '',
    webOrdering: boolFromApi(offer.webOrdering),
    webOrderingFee: '',
    webOrderingRevenuePercent: '',
    paidTrial: offer.paidTrial,
    paidTrialDays: '',
    preTrialSetupFee:
      offer.preTrialSetupFee == null ? '0' : String(offer.preTrialSetupFee),
    postTrialSetupFee: '0',
    accessStartsAt: offer.accessStartsAt
      ? toLocalDatetimeValue(offer.accessStartsAt)
      : '',
    accessStartsEmpty: !offer.accessStartsAt,
    trialStartsAt: offer.trialStartsAt
      ? toLocalDatetimeValue(offer.trialStartsAt)
      : '',
    trialStartsEmpty: !offer.trialStartsAt,
    prorateBackdatedAccess: offer.prorateBackdatedAccess === false ? false : true,
    offerNotes: '',
  }
}

export function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** UTC calendar date of an ISO / datetime-local string (ms since epoch at UTC midnight). */
function utcDayMs(isoOrLocal: string): number | null {
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return null
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** True when accessStartsAt’s UTC date is today or earlier (UTC). */
export function isAccessStartOnOrBeforeTodayUtc(
  isoOrLocal: string | null | undefined
): boolean {
  if (!isoOrLocal || !String(isoOrLocal).trim()) return false
  const accessDay = utcDayMs(isoOrLocal)
  if (accessDay == null) return false
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return accessDay <= today
}

/**
 * Show backdated billing control: Subscription offer with access start ≤ today (UTC).
 */
export function showProrateBackdatedControl(
  form: Pick<FormState, 'paidTrial' | 'accessStartsAt' | 'accessStartsEmpty'>
): boolean {
  if (form.paidTrial) return false
  if (form.accessStartsEmpty || !form.accessStartsAt.trim()) return false
  return isAccessStartOnOrBeforeTodayUtc(form.accessStartsAt)
}

export function formToOffer(
  form: FormState
): RestoEnterpriseOfferInput | { error: string } {
  const monthlyPrice = Number(form.monthlyPrice)
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
    return { error: 'Recurring fees (monthly) must be a number > 0' }
  }
  const durationMonths = Number(form.durationMonths)
  if (
    !Number.isFinite(durationMonths) ||
    durationMonths <= 0 ||
    !Number.isInteger(durationMonths) ||
    !DURATION_CYCLES.some(c => c.months === durationMonths)
  ) {
    return { error: 'Duration must be 1 mo, 3 mo, 6 mo, 1 yr, or 2 yr' }
  }
  const price = monthlyPrice * durationMonths
  if (!Number.isFinite(price) || price <= 0) {
    return { error: 'Total term price must be greater than 0' }
  }

  function limitValue(
    unlimited: boolean,
    raw: string,
    label: string
  ): number | null | { error: string } {
    if (unlimited) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      return { error: `${label} must be a positive integer, or mark Unlimited` }
    }
    return n
  }

  const locations = limitValue(
    form.locationsUnlimited,
    form.locations,
    'Locations'
  )
  if (typeof locations === 'object' && locations && 'error' in locations) {
    return locations
  }
  const users = limitValue(form.usersUnlimited, form.users, 'Users')
  if (typeof users === 'object' && users && 'error' in users) return users
  const counters = limitValue(form.countersUnlimited, form.counters, 'Counters')
  if (typeof counters === 'object' && counters && 'error' in counters) {
    return counters
  }
  const ordersPerMonth = limitValue(
    form.ordersUnlimited,
    form.ordersPerMonth,
    'Orders / mo'
  )
  if (
    typeof ordersPerMonth === 'object' &&
    ordersPerMonth &&
    'error' in ordersPerMonth
  ) {
    return ordersPerMonth
  }

  function parseOptionalDatetime(
    raw: string,
    empty: boolean,
    label: string
  ): string | null | { error: string } {
    if (empty || !raw.trim()) return null
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) {
      return { error: `${label} must be a valid date/time` }
    }
    return d.toISOString()
  }

  const trialStartsAt = parseOptionalDatetime(
    form.trialStartsAt,
    form.trialStartsEmpty,
    'Trial start'
  )
  if (typeof trialStartsAt === 'object' && trialStartsAt && 'error' in trialStartsAt) {
    return trialStartsAt
  }
  if (form.paidTrial && trialStartsAt == null) {
    return { error: 'Trial start is required' }
  }

  const accessStartsAt = parseOptionalDatetime(
    form.accessStartsAt,
    form.accessStartsEmpty,
    'Subscription start'
  )
  if (
    typeof accessStartsAt === 'object' &&
    accessStartsAt &&
    'error' in accessStartsAt
  ) {
    return accessStartsAt
  }
  if (!form.paidTrial && accessStartsAt == null) {
    return { error: 'Subscription start is required' }
  }

  const setupFee = Number(form.setupFee)
  if (!Number.isFinite(setupFee) || setupFee < 0) {
    return { error: 'Setup fee must be a number >= 0' }
  }
  const preTrialSetupFee = Number(form.preTrialSetupFee)
  if (!Number.isFinite(preTrialSetupFee) || preTrialSetupFee < 0) {
    return { error: 'Pre-trial setup must be a number >= 0' }
  }

  // Trial → null. Subscription with future/empty start → Nest default true.
  // Subscription with past/today start → form value.
  let prorateBackdatedAccess: boolean | null
  if (form.paidTrial) {
    prorateBackdatedAccess = null
  } else if (
    accessStartsAt == null ||
    !isAccessStartOnOrBeforeTodayUtc(accessStartsAt as string)
  ) {
    prorateBackdatedAccess = true
  } else {
    prorateBackdatedAccess = form.prorateBackdatedAccess !== false
  }

  return {
    price,
    durationMonths,
    // Sent on trial too as planned subscription setup (not charged until convert).
    setupFee,
    locations: locations as number | null,
    users: users as number | null,
    counters: counters as number | null,
    ordersPerMonth: ordersPerMonth as number | null,
    callCenter: form.callCenter,
    kds: form.kds,
    inventory: form.inventory,
    support: form.support,
    webOrdering: form.webOrdering,
    paidTrial: form.paidTrial,
    paidTrialDays: null,
    preTrialSetupFee: form.paidTrial ? preTrialSetupFee : 0,
    postTrialSetupFee: 0,
    accessStartsAt: accessStartsAt as string | null,
    trialStartsAt: trialStartsAt as string | null,
    prorateBackdatedAccess,
    enterpriseEnabled: true,
  }
}

export { fmtMoney }

export function fmtLimit(v: LimitValue | number | null | undefined): string {
  if (v == null || v === 'unlimited') return 'Unlimited'
  return String(v)
}

export function fmtBool(v: boolean | null | undefined): string {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '—'
}

export function fmtDate(iso: string | null | undefined): string {
  return formatWhen(iso)
}

export const DEFAULT_OFFER: RestoEnterpriseOfferInput = {
  price: 420,
  durationMonths: 12,
  setupFee: 0,
  locations: null,
  users: null,
  counters: null,
  ordersPerMonth: null,
  callCenter: false,
  kds: false,
  inventory: false,
  support: false,
  webOrdering: false,
  paidTrial: false,
  paidTrialDays: null,
  preTrialSetupFee: 0,
  postTrialSetupFee: 0,
  accessStartsAt: null,
  trialStartsAt: null,
  prorateBackdatedAccess: true,
  enterpriseEnabled: true,
}

export function subHasSavedOffer(sub: RestoSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  return (
    sub.enterprisePrice != null &&
    Number.isFinite(sub.enterprisePrice) &&
    sub.enterprisePrice > 0
  )
}

/** Nest Ent/Trial is active (tenant already accepted a trial). */
export function isEnterprisePaidTrialActive(
  sub: RestoSubscriptionSnapshot | null
): boolean {
  if (!sub) return false
  if (sub.enterpriseInPaidTrial === true) return true
  const base = normalizePlanBaseId(sub.planId)
  const status = (sub.status || '').toLowerCase()
  return (
    base === 'enterprise' &&
    (status === 'trial' || status === 'trialing')
  )
}

/** Live accepted Enterprise snapshot on Nest (`current_enterprise_*`). */
export function hasCurrentEnterpriseSnapshot(
  sub: RestoSubscriptionSnapshot | null
): boolean {
  if (!sub) return false
  return (
    sub.currentEnterprisePrice != null ||
    sub.currentEnterpriseDurationMonths != null ||
    sub.currentEnterpriseLocationsLimit != null ||
    sub.currentEnterpriseUsersLimit != null ||
    sub.currentEnterpriseCountersLimit != null ||
    sub.currentEnterpriseOrdersMonthLimit != null ||
    sub.currentEnterpriseCallcenterEnabled != null ||
    sub.currentEnterpriseKdsEnabled != null ||
    sub.currentEnterpriseInventoryEnabled != null ||
    sub.currentEnterpriseSupportEnabled != null ||
    sub.currentEnterpriseWebOrderingEnabled != null
  )
}

/**
 * Live Enterprise (offer accepted) — full sub terms or active paid trial.
 * Trial checkout often leaves current_enterprise_price null until convert.
 */
export function isEnterpriseLive(sub: RestoSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  if (isEnterprisePaidTrialActive(sub)) return true
  const base = normalizePlanBaseId(sub.planId)
  return base === 'enterprise' && sub.currentEnterprisePrice != null
}

/**
 * Nest DELETE returns 409 when plan is Enterprise OR current_enterprise_price is set
 * unless force=true.
 */
export function needsEnterpriseClearForce(
  sub: RestoSubscriptionSnapshot | null
): boolean {
  if (!sub) return false
  if (sub.currentEnterprisePrice != null) return true
  if (isEnterprisePaidTrialActive(sub)) return true
  return normalizePlanBaseId(sub.planId) === 'enterprise'
}

function numDiffers(
  offer: number | null | undefined,
  live: number | null | undefined
): boolean {
  if (live == null) return false
  if (offer == null) return true
  return Math.abs(Number(offer) - Number(live)) > 0.001
}

function intDiffers(
  offer: number | null | undefined,
  live: number | null | undefined
): boolean {
  if (live == null) return false
  if (offer == null) return true
  return Number(offer) !== Number(live)
}

function boolDiffers(
  offer: boolean | null | undefined,
  live: boolean | null | undefined
): boolean {
  if (live == null) return false
  return (offer === true) !== (live === true)
}

/** True when the sales offer diverges from Nest’s accepted current_* terms. */
export function offerDiffersFromCurrent(
  sub: RestoSubscriptionSnapshot
): boolean {
  const onTrial = isEnterprisePaidTrialActive(sub)

  // Live entitlements (always comparable when Nest mirrored them).
  if (
    intDiffers(
      sub.enterpriseLocationsLimit,
      sub.currentEnterpriseLocationsLimit
    ) ||
    intDiffers(sub.enterpriseUsersLimit, sub.currentEnterpriseUsersLimit) ||
    intDiffers(
      sub.enterpriseCountersLimit,
      sub.currentEnterpriseCountersLimit
    ) ||
    intDiffers(
      sub.enterpriseOrdersMonthLimit,
      sub.currentEnterpriseOrdersMonthLimit
    ) ||
    boolDiffers(
      sub.enterpriseCallcenterEnabled,
      sub.currentEnterpriseCallcenterEnabled
    ) ||
    boolDiffers(sub.enterpriseKdsEnabled, sub.currentEnterpriseKdsEnabled) ||
    boolDiffers(
      sub.enterpriseInventoryEnabled,
      sub.currentEnterpriseInventoryEnabled
    ) ||
    boolDiffers(sub.addonSupportEnabled, sub.currentEnterpriseSupportEnabled) ||
    boolDiffers(
      sub.addonWebOrderingEnabled,
      sub.currentEnterpriseWebOrderingEnabled
    )
  ) {
    return true
  }

  if (onTrial) {
    // On Ent/Trial, Nest puts the accepted *trial fee* (pre-trial setup) in
    // current_enterprise_price. enterprisePrice / setupFee / duration are
    // planned convert FYI only — never treat those as a pending re-offer.
    if (sub.currentEnterprisePrice != null) {
      const trialFee = sub.enterprisePreTrialSetupFee
      if (trialFee != null && numDiffers(trialFee, sub.currentEnterprisePrice)) {
        return true
      }
    }
    return false
  }

  // Live subscription: compare commercial terms.
  if (
    numDiffers(sub.enterprisePrice, sub.currentEnterprisePrice) ||
    intDiffers(sub.enterpriseDurationMonths, sub.currentEnterpriseDurationMonths)
  ) {
    return true
  }
  return false
}

/**
 * Status for the *New* column:
 * - blank until an offer is saved
 * - "Pending" after save while not yet live on Enterprise / Ent/Trial
 * - "Pending re-acceptance" if already live/trial but a new offer differs
 *   from Nest current_enterprise_* (never treat a fresh PUT as accepted)
 * - blank when offer matches accepted current_* (or trial with no current_* yet)
 */
export function newOfferStatusLabel(sub: RestoSubscriptionSnapshot | null): string {
  if (!subHasSavedOffer(sub) || !sub) return ''

  if (!isEnterpriseLive(sub)) {
    return 'Pending'
  }

  // Already on Ent/Trial or live Enterprise: only current_* is accepted.
  // A new PUT updates enterprise_* only — surface re-acceptance when it diverges.
  if (hasCurrentEnterpriseSnapshot(sub)) {
    if (offerDiffersFromCurrent(sub)) return 'Pending re-acceptance'
    return ''
  }

  // Trial active but Nest has not mirrored current_* yet (first accept).
  // Do not bind "accepted" to enterprise_* — that would clear Pending on re-offer.
  if (isEnterprisePaidTrialActive(sub)) {
    return ''
  }

  return 'Pending'
}

function offerFromSaved(sub: RestoSubscriptionSnapshot): RestoEnterpriseOfferInput {
  return {
    price: sub.enterprisePrice ?? DEFAULT_OFFER.price,
    durationMonths: sub.enterpriseDurationMonths ?? DEFAULT_OFFER.durationMonths,
    setupFee: sub.enterpriseSetupFee ?? 0,
    locations: sub.enterpriseLocationsLimit,
    users: sub.enterpriseUsersLimit,
    counters: sub.enterpriseCountersLimit,
    ordersPerMonth: sub.enterpriseOrdersMonthLimit,
    callCenter: boolFromApi(sub.enterpriseCallcenterEnabled),
    kds: boolFromApi(sub.enterpriseKdsEnabled),
    inventory: boolFromApi(sub.enterpriseInventoryEnabled),
    support: boolFromApi(sub.addonSupportEnabled),
    webOrdering: boolFromApi(sub.addonWebOrderingEnabled),
    paidTrial: sub.enterprisePaidTrialEnabled === true,
    paidTrialDays: null,
    preTrialSetupFee: sub.enterprisePreTrialSetupFee ?? 0,
    postTrialSetupFee: 0,
    accessStartsAt: sub.enterpriseAccessStartsAt,
    trialStartsAt: sub.enterpriseTrialStartsAt,
    prorateBackdatedAccess:
      sub.enterprisePaidTrialEnabled === true
        ? null
        : sub.prorateBackdatedAccess === false
          ? false
          : true,
    enterpriseEnabled: true,
  }
}

function offerFromActivePlan(plan: ActivePlanView): RestoEnterpriseOfferInput {
  const seed = activePlanToOfferSeed(plan, {
    price: DEFAULT_OFFER.price,
    durationMonths: DEFAULT_OFFER.durationMonths,
  })
  const durationMonths = snapDurationMonths(seed.durationMonths)
  return {
    price: seed.monthlyPrice * durationMonths,
    durationMonths,
    setupFee: 0,
    locations: seed.locations,
    users: seed.users,
    counters: seed.counters,
    ordersPerMonth: seed.ordersPerMonth,
    callCenter: seed.callCenter,
    kds: seed.kds,
    inventory: seed.inventory,
    support: seed.support,
    webOrdering: seed.webOrdering,
    paidTrial: false,
    paidTrialDays: null,
    preTrialSetupFee: 0,
    postTrialSetupFee: 0,
    accessStartsAt: null,
    trialStartsAt: null,
    prorateBackdatedAccess: true,
    enterpriseEnabled: true,
  }
}

/**
 * Prefill New column:
 * - Prefer the saved Enterprise OFFER whenever Nest has one (so reload keeps edits).
 * - On active Ent/Trial, keep the saved offer (trial + planned convert terms).
 * - Only when live Enterprise subscription is active and nothing is pending
 *   re-acceptance, New mirrors the live plan (ready for the next offer draft).
 */
export function formOfferFromSubscription(
  sub: RestoSubscriptionSnapshot | null
): RestoEnterpriseOfferInput {
  if (!sub) return DEFAULT_OFFER

  const plan = resolveActivePlanView(sub)
  const pending = newOfferStatusLabel(sub)

  if (subHasSavedOffer(sub) && pending) {
    return offerFromSaved(sub)
  }

  if (isEnterprisePaidTrialActive(sub) && subHasSavedOffer(sub)) {
    return offerFromSaved(sub)
  }

  if (isEnterpriseLive(sub) && !pending) {
    return plan ? offerFromActivePlan(plan) : DEFAULT_OFFER
  }

  if (subHasSavedOffer(sub)) {
    return offerFromSaved(sub)
  }

  if (plan) return offerFromActivePlan(plan)
  return DEFAULT_OFFER
}

export function currentValues(
  plan: ActivePlanView | null,
  sub: RestoSubscriptionSnapshot | null
) {
  if (!plan) {
    return {
      plan: '—',
      status: '—',
      offerType: '—',
      monthly: '—',
      duration: '—',
      termTotal: '—',
      setupFee: '—',
      preTrial: '—',
      locations: '—',
      users: '—',
      counters: '—',
      orders: '—',
      callCenter: '—',
      kds: '—',
      inventory: '—',
      support: '—',
      webOrdering: '—',
      trialStart: '—',
      subscriptionStart: '—',
      backdatedBilling: '—',
      period: '—',
    }
  }

  const onTrial =
    plan.paidTrial === true ||
    sub?.enterpriseInPaidTrial === true ||
    isEnterprisePaidTrialActive(sub)

  // Current column must never read sales-offer enterprise_* fields. Those update
  // on Save immediately and would make a re-offer look already accepted.
  return {
    plan: `${plan.planName}`,
    status: `${plan.status ?? '—'} · ${plan.billingCycle ?? '—'}`,
    offerType: onTrial
      ? 'Ent/Trial'
      : normalizePlanBaseId(plan.planId) === 'enterprise'
        ? 'Ent/Sub'
        : '—',
    monthly:
      plan.monthlyPrice != null ? `${fmtMoney(plan.monthlyPrice)}/mo` : 'Custom',
    duration: durationCycleLabel(plan.durationMonths),
    termTotal: plan.termPrice != null ? fmtMoney(plan.termPrice) : '—',
    setupFee: plan.setupFee != null ? fmtMoney(plan.setupFee) : '—',
    // On trial Nest stores accepted trial fee in current_enterprise_price.
    preTrial:
      onTrial && sub?.currentEnterprisePrice != null
        ? fmtMoney(sub.currentEnterprisePrice)
        : '—',
    locations: fmtLimit(plan.locations),
    users: fmtLimit(plan.users),
    counters: fmtLimit(plan.counters),
    orders: fmtLimit(plan.ordersMonth),
    callCenter: fmtBool(plan.callCenter),
    kds: fmtBool(plan.kds),
    inventory: fmtBool(plan.inventory),
    support: fmtBool(plan.support),
    webOrdering: fmtBool(plan.webOrdering),
    trialStart: sub?.trialStartedAt
      ? fmtDate(sub.trialStartedAt)
      : '—',
    subscriptionStart: plan.periodStart
      ? fmtDate(plan.periodStart)
      : '—',
    backdatedBilling:
      onTrial || sub?.prorateBackdatedAccess == null
        ? '—'
        : sub.prorateBackdatedAccess
          ? 'Prorate'
          : 'Full periods',
    period: `${fmtDate(plan.periodStart)} → ${fmtDate(plan.periodEnd)}`,
  }
}

function nearlyEqual(a: number, b: number, eps = 0.005): boolean {
  return Math.abs(a - b) <= eps
}

function limitFromForm(
  unlimited: boolean,
  raw: string
): number | 'unlimited' | null {
  if (unlimited) return 'unlimited'
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function limitEquals(
  formVal: number | 'unlimited' | null,
  planVal: LimitValue | null | undefined
): boolean {
  if (formVal == null) return false
  if (planVal == null || planVal === 'unlimited') {
    return formVal === 'unlimited'
  }
  if (formVal === 'unlimited') return false
  return formVal === planVal
}

export function formDiffs(
  form: FormState,
  plan: ActivePlanView | null,
  termTotal: number | null,
  sub: RestoSubscriptionSnapshot | null = null
): Record<string, boolean> {
  if (!plan) {
    return {}
  }

  const monthly = Number(form.monthlyPrice)
  const duration = Number(form.durationMonths)
  const setupFee = Number(form.setupFee)
  const preTrial = Number(form.preTrialSetupFee)

  const planMonthly = plan.monthlyPrice
  const planDuration = plan.durationMonths
  const planTerm = plan.termPrice
  const planOnTrial = plan.paidTrial === true

  return {
    offerType: form.paidTrial !== planOnTrial,
    monthly:
      planMonthly == null || !Number.isFinite(monthly)
        ? planMonthly != null || Number.isFinite(monthly)
        : !nearlyEqual(monthly, planMonthly),
    duration:
      planDuration == null || !Number.isFinite(duration)
        ? planDuration != null || (Number.isFinite(duration) && duration > 0)
        : duration !== planDuration,
    termTotal:
      termTotal == null || planTerm == null
        ? termTotal != null || planTerm != null
        : !nearlyEqual(termTotal, planTerm),
    locations: !limitEquals(
      limitFromForm(form.locationsUnlimited, form.locations),
      plan.locations
    ),
    users: !limitEquals(
      limitFromForm(form.usersUnlimited, form.users),
      plan.users
    ),
    counters: !limitEquals(
      limitFromForm(form.countersUnlimited, form.counters),
      plan.counters
    ),
    orders: !limitEquals(
      limitFromForm(form.ordersUnlimited, form.ordersPerMonth),
      plan.ordersMonth
    ),
    callCenter: form.callCenter !== plan.callCenter,
    kds: form.kds !== plan.kds,
    inventory: form.inventory !== plan.inventory,
    support: form.support !== plan.support,
    webOrdering: form.webOrdering !== plan.webOrdering,
    trialStart: (() => {
      const formImm = form.trialStartsEmpty || !form.trialStartsAt
      const live = sub?.trialStartedAt
      const planImm = !live
      if (formImm && planImm) return false
      if (formImm !== planImm) return true
      if (!form.trialStartsAt || !live) return true
      return toLocalDatetimeValue(live) !== form.trialStartsAt
    })(),
    subscriptionStart: (() => {
      const formImm = form.accessStartsEmpty || !form.accessStartsAt
      const live = plan.periodStart
      const planImm = !live
      if (formImm && planImm) return false
      if (formImm !== planImm) return true
      if (!form.accessStartsAt || !live) return true
      return toLocalDatetimeValue(live) !== form.accessStartsAt
    })(),
    setupFee: Number.isFinite(setupFee) && setupFee > 0,
    preTrial: form.paidTrial && Number.isFinite(preTrial) && preTrial > 0,
    backdatedBilling: (() => {
      if (!showProrateBackdatedControl(form)) return false
      if (sub?.prorateBackdatedAccess == null) {
        return form.prorateBackdatedAccess === false
      }
      return form.prorateBackdatedAccess !== (sub.prorateBackdatedAccess === true)
    })(),
  }
}

export function offerNotesDiff(
  formNotes: string,
  savedNotes: string | null
): boolean {
  return (formNotes.trim() || null) !== (savedNotes?.trim() || null)
}
