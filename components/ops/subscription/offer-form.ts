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
  paidTrial: boolean
  paidTrialDays: string
  preTrialSetupFee: string
  postTrialSetupFee: string
  accessStartsAt: string
  accessStartsEmpty: boolean
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

export function offerToForm(offer: RestoEnterpriseOfferInput): FormState {
  const durationMonths = offer.durationMonths > 0 ? offer.durationMonths : 1
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
    paidTrialDays:
      offer.paidTrialDays == null ? '' : String(offer.paidTrialDays),
    preTrialSetupFee:
      offer.preTrialSetupFee == null ? '0' : String(offer.preTrialSetupFee),
    postTrialSetupFee:
      offer.postTrialSetupFee == null ? '0' : String(offer.postTrialSetupFee),
    accessStartsAt: offer.accessStartsAt
      ? toLocalDatetimeValue(offer.accessStartsAt)
      : '',
    accessStartsEmpty: !offer.accessStartsAt,
  }
}

export function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minAccessDatetimeLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`
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
    !Number.isInteger(durationMonths)
  ) {
    return { error: 'durationMonths must be a positive integer' }
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

  const locations = limitValue(form.locationsUnlimited, form.locations, 'Branches')
  if (typeof locations === 'object' && locations && 'error' in locations) return locations
  const users = limitValue(form.usersUnlimited, form.users, 'users')
  if (typeof users === 'object' && users && 'error' in users) return users
  const counters = limitValue(form.countersUnlimited, form.counters, 'counters')
  if (typeof counters === 'object' && counters && 'error' in counters) return counters
  const ordersPerMonth = limitValue(
    form.ordersUnlimited,
    form.ordersPerMonth,
    'ordersPerMonth'
  )
  if (typeof ordersPerMonth === 'object' && ordersPerMonth && 'error' in ordersPerMonth) {
    return ordersPerMonth
  }

  let paidTrialDays: number | null = null
  if (form.paidTrial) {
    const days = Number(form.paidTrialDays)
    if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
      return { error: 'paidTrial requires a positive integer for paidTrialDays' }
    }
    paidTrialDays = days
  }

  let accessStartsAt: string | null = null
  if (!form.accessStartsEmpty && form.accessStartsAt.trim()) {
    if (form.paidTrial) {
      return { error: 'Cannot combine paid trial with accessStartsAt' }
    }
    const d = new Date(form.accessStartsAt)
    if (Number.isNaN(d.getTime())) {
      return { error: 'accessStartsAt must be a valid datetime' }
    }
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    if (d.getTime() < startOfToday.getTime()) {
      return { error: 'Access starts cannot be before today' }
    }
    accessStartsAt = d.toISOString()
  }

  const setupFee = Number(form.setupFee)
  if (!Number.isFinite(setupFee) || setupFee < 0) {
    return { error: 'setupFee must be a number >= 0' }
  }
  const preTrialSetupFee = Number(form.preTrialSetupFee)
  if (!Number.isFinite(preTrialSetupFee) || preTrialSetupFee < 0) {
    return { error: 'preTrialSetupFee must be a number >= 0' }
  }
  const postTrialSetupFee = Number(form.postTrialSetupFee)
  if (!Number.isFinite(postTrialSetupFee) || postTrialSetupFee < 0) {
    return { error: 'postTrialSetupFee must be a number >= 0' }
  }

  return {
    price,
    durationMonths,
    setupFee: form.paidTrial ? 0 : setupFee,
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
    paidTrialDays,
    preTrialSetupFee: form.paidTrial ? preTrialSetupFee : 0,
    postTrialSetupFee: form.paidTrial ? postTrialSetupFee : 0,
    accessStartsAt,
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

/** Live Enterprise (offer accepted) — current snapshot present. */
export function isEnterpriseLive(sub: RestoSubscriptionSnapshot | null): boolean {
  if (!sub) return false
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
  return normalizePlanBaseId(sub.planId) === 'enterprise'
}

/**
 * Status for the *New* column:
 * - blank until an offer is saved
 * - "Pending" after save while not yet live on Enterprise
 * - "Pending re-acceptance" if already live but a new offer differs
 * - blank when offer is live and matches (accepted, no new sale offer change)
 */
export function newOfferStatusLabel(sub: RestoSubscriptionSnapshot | null): string {
  if (!subHasSavedOffer(sub) || !sub) return ''

  if (!isEnterpriseLive(sub)) {
    return 'Pending'
  }

  const offerPrice = sub.enterprisePrice
  const offerMonths = sub.enterpriseDurationMonths
  const livePrice = sub.currentEnterprisePrice
  const liveMonths = sub.currentEnterpriseDurationMonths
  const priceDiff =
    offerPrice != null &&
    livePrice != null &&
    Math.abs(Number(offerPrice) - Number(livePrice)) > 0.001
  const monthsDiff =
    offerMonths != null &&
    liveMonths != null &&
    Number(offerMonths) !== Number(liveMonths)

  const limitDiff =
    (sub.enterpriseLocationsLimit ?? null) !==
      (sub.currentEnterpriseLocationsLimit ?? null) ||
    (sub.enterpriseUsersLimit ?? null) !==
      (sub.currentEnterpriseUsersLimit ?? null) ||
    (sub.enterpriseCountersLimit ?? null) !==
      (sub.currentEnterpriseCountersLimit ?? null) ||
    (sub.enterpriseOrdersMonthLimit ?? null) !==
      (sub.currentEnterpriseOrdersMonthLimit ?? null)

  if (priceDiff || monthsDiff || limitDiff) {
    return 'Pending re-acceptance'
  }
  return ''
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
    paidTrialDays:
      sub.enterprisePaidTrialEnabled === true
        ? sub.enterprisePaidTrialDurationDays
        : null,
    preTrialSetupFee: sub.enterprisePreTrialSetupFee ?? 0,
    postTrialSetupFee: sub.enterprisePostTrialSetupFee ?? 0,
    accessStartsAt:
      sub.enterprisePaidTrialEnabled === true
        ? null
        : sub.enterpriseAccessStartsAt,
    enterpriseEnabled: true,
  }
}

function offerFromActivePlan(plan: ActivePlanView): RestoEnterpriseOfferInput {
  const seed = activePlanToOfferSeed(plan, {
    price: DEFAULT_OFFER.price,
    durationMonths: DEFAULT_OFFER.durationMonths,
  })
  const durationMonths = seed.durationMonths
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
    enterpriseEnabled: true,
  }
}

/**
 * Prefill New column:
 * - Prefer the saved Enterprise OFFER whenever Nest has one (so reload keeps edits).
 * - Only when live Enterprise is active and nothing is pending re-acceptance,
 *   New mirrors the live plan (ready for the next offer draft).
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
      monthly: '—',
      duration: '—',
      termTotal: '—',
      setupFee: '—',
      preTrial: '—',
      postTrial: '—',
      locations: '—',
      users: '—',
      counters: '—',
      orders: '—',
      callCenter: '—',
      kds: '—',
      inventory: '—',
      support: '—',
      webOrdering: '—',
      paidTrial: '—',
      trialDays: '—',
      accessStarts: '—',
      period: '—',
    }
  }
  return {
    plan: `${plan.planName}`,
    status: `${plan.status ?? '—'} · ${plan.billingCycle ?? '—'}`,
    monthly:
      plan.monthlyPrice != null ? `${fmtMoney(plan.monthlyPrice)}/mo` : 'Custom',
    duration: plan.durationMonths != null ? `${plan.durationMonths}` : '—',
    termTotal: plan.termPrice != null ? fmtMoney(plan.termPrice) : '—',
    setupFee: plan.setupFee != null ? fmtMoney(plan.setupFee) : '—',
    preTrial:
      sub?.enterprisePreTrialSetupFee != null && isEnterpriseLive(sub)
        ? fmtMoney(sub.enterprisePreTrialSetupFee)
        : '—',
    postTrial:
      sub?.enterprisePostTrialSetupFee != null && isEnterpriseLive(sub)
        ? fmtMoney(sub.enterprisePostTrialSetupFee)
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
    paidTrial: fmtBool(plan.paidTrial),
    trialDays: plan.paidTrialDays != null ? String(plan.paidTrialDays) : '—',
    accessStarts: plan.accessStartsAt ? fmtDate(plan.accessStartsAt) : 'Immediate',
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
  termTotal: number | null
): Record<string, boolean> {
  if (!plan) {
    return {}
  }

  const monthly = Number(form.monthlyPrice)
  const duration = Number(form.durationMonths)
  const setupFee = Number(form.setupFee)
  const preTrial = Number(form.preTrialSetupFee)
  const postTrial = Number(form.postTrialSetupFee)
  const trialDays = Number(form.paidTrialDays)

  const planMonthly = plan.monthlyPrice
  const planDuration = plan.durationMonths
  const planTerm = plan.termPrice

  return {
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
    paidTrial: form.paidTrial !== plan.paidTrial,
    trialDays: form.paidTrial
      ? plan.paidTrialDays == null
        ? Number.isFinite(trialDays) && trialDays > 0
        : trialDays !== plan.paidTrialDays
      : plan.paidTrialDays != null && plan.paidTrialDays > 0,
    accessStarts: (() => {
      const formImm =
        form.accessStartsEmpty || form.paidTrial || !form.accessStartsAt
      const planImm = !plan.accessStartsAt
      if (formImm && planImm) return false
      if (formImm !== planImm) return true
      if (!form.accessStartsAt || !plan.accessStartsAt) return true
      return toLocalDatetimeValue(plan.accessStartsAt) !== form.accessStartsAt
    })(),
    setupFee: !form.paidTrial && Number.isFinite(setupFee) && setupFee > 0,
    preTrial: form.paidTrial && Number.isFinite(preTrial) && preTrial > 0,
    postTrial: form.paidTrial && Number.isFinite(postTrial) && postTrial > 0,
  }
}
