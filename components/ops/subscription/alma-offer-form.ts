import type {
  AlmaEnterpriseOfferInput,
  AlmaSubscriptionSnapshot,
} from '@/lib/alma-admin/types'
import {
  activePlanToOfferSeed,
  normalizePlanBaseId,
  resolveActivePlanView,
  type AlmaActivePlanView,
  type LimitValue,
} from '@/lib/alma-admin/plan-catalog'
import { formatWhen } from '@/lib/format-when'
import { formatMoney as fmtMoney } from '@/lib/currency'

/** Minimum USD for recurring monthly (sub / planned) and trial pre-trial setup. */
export const MIN_OFFER_AMOUNT_USD = 0.5

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
  branches: string
  branchesUnlimited: boolean
  students: string
  studentsUnlimited: boolean
  storageGb: string
  storageGbUnlimited: boolean
  fees: boolean
  feesFee: string
  library: boolean
  libraryFee: string
  behavioural: boolean
  behaviouralFee: string
  uniformInventory: boolean
  uniformInventoryFee: string
  whiteLabel: boolean
  whiteLabelFee: string
  googleClassroom: boolean
  googleClassroomFee: string
  paidTrial: boolean
  paidTrialDays: string
  preTrialSetupFee: string
  postTrialSetupFee: string
  accessStartsAt: string
  accessStartsEmpty: boolean
  trialStartsAt: string
  trialStartsEmpty: boolean
  prorateBackdatedAccess: boolean
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

function monthlyFeeString(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return ''
  return String(v)
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

export function offerToForm(offer: AlmaEnterpriseOfferInput): FormState {
  const durationMonths = snapDurationMonths(
    offer.durationMonths > 0 ? offer.durationMonths : 12
  )
  const monthly = totalToMonthly(offer.price, durationMonths)
  return {
    monthlyPrice: String(monthly),
    durationMonths: String(durationMonths),
    setupFee: String(offer.setupFee ?? 0),
    branches: offer.branches == null ? '' : String(offer.branches),
    branchesUnlimited: offer.branches == null,
    students: offer.students == null ? '' : String(offer.students),
    studentsUnlimited: offer.students == null,
    storageGb: offer.storageGb == null ? '' : String(offer.storageGb),
    storageGbUnlimited: offer.storageGb == null,
    fees: boolFromApi(offer.fees),
    feesFee: monthlyFeeString(offer.feesMonthly),
    library: boolFromApi(offer.library),
    libraryFee: monthlyFeeString(offer.libraryMonthly),
    behavioural: boolFromApi(offer.behavioural),
    behaviouralFee: monthlyFeeString(offer.behaviouralMonthly),
    uniformInventory: boolFromApi(offer.uniformInventory),
    uniformInventoryFee: monthlyFeeString(offer.uniformInventoryMonthly),
    whiteLabel: boolFromApi(offer.whiteLabel),
    whiteLabelFee: monthlyFeeString(offer.whiteLabelMonthly),
    googleClassroom: boolFromApi(offer.googleClassroom),
    googleClassroomFee: monthlyFeeString(offer.googleClassroomMonthly),
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

function utcDayMs(isoOrLocal: string): number | null {
  const d = new Date(isoOrLocal)
  if (Number.isNaN(d.getTime())) return null
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

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

export function showProrateBackdatedControl(
  form: Pick<FormState, 'paidTrial' | 'accessStartsAt' | 'accessStartsEmpty'>
): boolean {
  if (form.paidTrial) return false
  if (form.accessStartsEmpty || !form.accessStartsAt.trim()) return false
  return isAccessStartOnOrBeforeTodayUtc(form.accessStartsAt)
}

function parseAddonMonthly(
  enabled: boolean,
  raw: string,
  label: string
): number | null | { error: string } {
  if (!enabled) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${label} monthly fee must be a number >= 0` }
  }
  return n
}

export function formToOffer(
  form: FormState
): AlmaEnterpriseOfferInput | { error: string } {
  const monthlyPrice = Number(form.monthlyPrice)
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < MIN_OFFER_AMOUNT_USD) {
    return {
      error: `Recurring fees (monthly) must be at least $${MIN_OFFER_AMOUNT_USD}`,
    }
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

  const branches = limitValue(
    form.branchesUnlimited,
    form.branches,
    'Branches'
  )
  if (typeof branches === 'object' && branches && 'error' in branches) {
    return branches
  }
  const students = limitValue(form.studentsUnlimited, form.students, 'Students')
  if (typeof students === 'object' && students && 'error' in students) {
    return students
  }
  const storageGb = limitValue(
    form.storageGbUnlimited,
    form.storageGb,
    'Storage (GB)'
  )
  if (typeof storageGb === 'object' && storageGb && 'error' in storageGb) {
    return storageGb
  }

  const feesMonthly = parseAddonMonthly(form.fees, form.feesFee, 'Fees')
  if (typeof feesMonthly === 'object' && feesMonthly && 'error' in feesMonthly) {
    return feesMonthly
  }
  const libraryMonthly = parseAddonMonthly(
    form.library,
    form.libraryFee,
    'Library'
  )
  if (
    typeof libraryMonthly === 'object' &&
    libraryMonthly &&
    'error' in libraryMonthly
  ) {
    return libraryMonthly
  }
  const behaviouralMonthly = parseAddonMonthly(
    form.behavioural,
    form.behaviouralFee,
    'Behavioural'
  )
  if (
    typeof behaviouralMonthly === 'object' &&
    behaviouralMonthly &&
    'error' in behaviouralMonthly
  ) {
    return behaviouralMonthly
  }
  const uniformInventoryMonthly = parseAddonMonthly(
    form.uniformInventory,
    form.uniformInventoryFee,
    'Uniform inventory'
  )
  if (
    typeof uniformInventoryMonthly === 'object' &&
    uniformInventoryMonthly &&
    'error' in uniformInventoryMonthly
  ) {
    return uniformInventoryMonthly
  }
  const whiteLabelMonthly = parseAddonMonthly(
    form.whiteLabel,
    form.whiteLabelFee,
    'White label'
  )
  if (
    typeof whiteLabelMonthly === 'object' &&
    whiteLabelMonthly &&
    'error' in whiteLabelMonthly
  ) {
    return whiteLabelMonthly
  }
  const googleClassroomMonthly = parseAddonMonthly(
    form.googleClassroom,
    form.googleClassroomFee,
    'Google Classroom'
  )
  if (
    typeof googleClassroomMonthly === 'object' &&
    googleClassroomMonthly &&
    'error' in googleClassroomMonthly
  ) {
    return googleClassroomMonthly
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
  if (form.paidTrial && preTrialSetupFee < MIN_OFFER_AMOUNT_USD) {
    return {
      error: `Pre-trial setup must be at least $${MIN_OFFER_AMOUNT_USD}`,
    }
  }

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
    setupFee,
    branches: branches as number | null,
    students: students as number | null,
    storageGb: storageGb as number | null,
    fees: form.fees,
    library: form.library,
    behavioural: form.behavioural,
    uniformInventory: form.uniformInventory,
    whiteLabel: form.whiteLabel,
    googleClassroom: form.googleClassroom,
    feesMonthly,
    libraryMonthly,
    behaviouralMonthly,
    uniformInventoryMonthly,
    whiteLabelMonthly,
    googleClassroomMonthly,
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

export const DEFAULT_OFFER: AlmaEnterpriseOfferInput = {
  price: 420,
  durationMonths: 12,
  setupFee: 0,
  branches: null,
  students: null,
  storageGb: null,
  fees: false,
  library: false,
  behavioural: false,
  uniformInventory: false,
  whiteLabel: false,
  googleClassroom: false,
  feesMonthly: null,
  libraryMonthly: null,
  behaviouralMonthly: null,
  uniformInventoryMonthly: null,
  whiteLabelMonthly: null,
  googleClassroomMonthly: null,
  paidTrial: false,
  paidTrialDays: null,
  preTrialSetupFee: 0,
  postTrialSetupFee: 0,
  accessStartsAt: null,
  trialStartsAt: null,
  prorateBackdatedAccess: true,
  enterpriseEnabled: true,
}

export function subHasSavedOffer(sub: AlmaSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  return (
    sub.enterprisePrice != null &&
    Number.isFinite(sub.enterprisePrice) &&
    sub.enterprisePrice > 0
  )
}

export function isEnterprisePaidTrialActive(
  sub: AlmaSubscriptionSnapshot | null
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

export function hasCurrentEnterpriseSnapshot(
  sub: AlmaSubscriptionSnapshot | null
): boolean {
  if (!sub) return false
  return (
    sub.currentEnterprisePrice != null ||
    sub.currentEnterpriseDurationMonths != null ||
    sub.currentEnterpriseBranchesLimit != null ||
    sub.currentEnterpriseStudentsLimit != null ||
    sub.currentEnterpriseStorageGbLimit != null ||
    sub.currentEnterpriseFeesEnabled != null ||
    sub.currentEnterpriseLibraryEnabled != null ||
    sub.currentEnterpriseBehaviouralEnabled != null ||
    sub.currentEnterpriseUniformInventoryEnabled != null ||
    sub.currentEnterpriseWhiteLabelEnabled != null ||
    sub.currentEnterpriseGoogleClassroomEnabled != null
  )
}

export function isEnterpriseLive(sub: AlmaSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  if (isEnterprisePaidTrialActive(sub)) return true
  const base = normalizePlanBaseId(sub.planId)
  return base === 'enterprise' && sub.currentEnterprisePrice != null
}

export function needsEnterpriseClearForce(
  sub: AlmaSubscriptionSnapshot | null
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

export function offerDiffersFromCurrent(
  sub: AlmaSubscriptionSnapshot
): boolean {
  const onTrial = isEnterprisePaidTrialActive(sub)

  if (
    intDiffers(sub.enterpriseBranchesLimit, sub.currentEnterpriseBranchesLimit) ||
    intDiffers(sub.enterpriseStudentsLimit, sub.currentEnterpriseStudentsLimit) ||
    intDiffers(sub.enterpriseStorageGbLimit, sub.currentEnterpriseStorageGbLimit) ||
    boolDiffers(sub.enterpriseFeesEnabled, sub.currentEnterpriseFeesEnabled) ||
    boolDiffers(sub.enterpriseLibraryEnabled, sub.currentEnterpriseLibraryEnabled) ||
    boolDiffers(
      sub.enterpriseBehaviouralEnabled,
      sub.currentEnterpriseBehaviouralEnabled
    ) ||
    boolDiffers(
      sub.enterpriseUniformInventoryEnabled,
      sub.currentEnterpriseUniformInventoryEnabled
    ) ||
    boolDiffers(
      sub.enterpriseWhiteLabelEnabled,
      sub.currentEnterpriseWhiteLabelEnabled
    ) ||
    boolDiffers(
      sub.enterpriseGoogleClassroomEnabled,
      sub.currentEnterpriseGoogleClassroomEnabled
    ) ||
    numDiffers(sub.enterpriseFeesMonthly, sub.currentEnterpriseFeesMonthly) ||
    numDiffers(sub.enterpriseLibraryMonthly, sub.currentEnterpriseLibraryMonthly) ||
    numDiffers(
      sub.enterpriseBehaviouralMonthly,
      sub.currentEnterpriseBehaviouralMonthly
    ) ||
    numDiffers(
      sub.enterpriseUniformInventoryMonthly,
      sub.currentEnterpriseUniformInventoryMonthly
    ) ||
    numDiffers(
      sub.enterpriseWhiteLabelMonthly,
      sub.currentEnterpriseWhiteLabelMonthly
    ) ||
    numDiffers(
      sub.enterpriseGoogleClassroomMonthly,
      sub.currentEnterpriseGoogleClassroomMonthly
    )
  ) {
    return true
  }

  if (onTrial) {
    if (sub.currentEnterprisePrice != null) {
      const trialFee = sub.enterprisePreTrialSetupFee
      if (trialFee != null && numDiffers(trialFee, sub.currentEnterprisePrice)) {
        return true
      }
    }
    return false
  }

  if (
    numDiffers(sub.enterprisePrice, sub.currentEnterprisePrice) ||
    intDiffers(sub.enterpriseDurationMonths, sub.currentEnterpriseDurationMonths)
  ) {
    return true
  }
  return false
}

export function newOfferStatusLabel(sub: AlmaSubscriptionSnapshot | null): string {
  if (!subHasSavedOffer(sub) || !sub) return ''

  if (!isEnterpriseLive(sub)) {
    return 'Pending'
  }

  if (hasCurrentEnterpriseSnapshot(sub)) {
    if (offerDiffersFromCurrent(sub)) return 'Pending re-acceptance'
    return ''
  }

  if (isEnterprisePaidTrialActive(sub)) {
    return ''
  }

  return 'Pending'
}

function offerFromSaved(sub: AlmaSubscriptionSnapshot): AlmaEnterpriseOfferInput {
  return {
    price: sub.enterprisePrice ?? DEFAULT_OFFER.price,
    durationMonths: sub.enterpriseDurationMonths ?? DEFAULT_OFFER.durationMonths,
    setupFee: sub.enterpriseSetupFee ?? 0,
    branches: sub.enterpriseBranchesLimit,
    students: sub.enterpriseStudentsLimit,
    storageGb: sub.enterpriseStorageGbLimit,
    fees: boolFromApi(sub.enterpriseFeesEnabled),
    library: boolFromApi(sub.enterpriseLibraryEnabled),
    behavioural: boolFromApi(sub.enterpriseBehaviouralEnabled),
    uniformInventory: boolFromApi(sub.enterpriseUniformInventoryEnabled),
    whiteLabel: boolFromApi(sub.enterpriseWhiteLabelEnabled),
    googleClassroom: boolFromApi(sub.enterpriseGoogleClassroomEnabled),
    feesMonthly: sub.enterpriseFeesMonthly,
    libraryMonthly: sub.enterpriseLibraryMonthly,
    behaviouralMonthly: sub.enterpriseBehaviouralMonthly,
    uniformInventoryMonthly: sub.enterpriseUniformInventoryMonthly,
    whiteLabelMonthly: sub.enterpriseWhiteLabelMonthly,
    googleClassroomMonthly: sub.enterpriseGoogleClassroomMonthly,
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

function offerFromActivePlan(plan: AlmaActivePlanView): AlmaEnterpriseOfferInput {
  const seed = activePlanToOfferSeed(plan, {
    price: DEFAULT_OFFER.price,
    durationMonths: DEFAULT_OFFER.durationMonths,
  })
  const durationMonths = snapDurationMonths(seed.durationMonths)
  return {
    price: seed.monthlyPrice * durationMonths,
    durationMonths,
    setupFee: 0,
    branches: seed.branches,
    students: seed.students,
    storageGb: seed.storageGb,
    fees: seed.fees,
    library: seed.library,
    behavioural: seed.behavioural,
    uniformInventory: seed.uniformInventory,
    whiteLabel: seed.whiteLabel,
    googleClassroom: seed.googleClassroom,
    feesMonthly: null,
    libraryMonthly: null,
    behaviouralMonthly: null,
    uniformInventoryMonthly: null,
    whiteLabelMonthly: null,
    googleClassroomMonthly: null,
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

export function formOfferFromSubscription(
  sub: AlmaSubscriptionSnapshot | null
): AlmaEnterpriseOfferInput {
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
  plan: AlmaActivePlanView | null,
  sub: AlmaSubscriptionSnapshot | null
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
      branches: '—',
      students: '—',
      storageGb: '—',
      fees: '—',
      library: '—',
      behavioural: '—',
      uniformInventory: '—',
      whiteLabel: '—',
      googleClassroom: '—',
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
    preTrial:
      onTrial && sub?.currentEnterprisePrice != null
        ? fmtMoney(sub.currentEnterprisePrice)
        : '—',
    branches: fmtLimit(plan.branches),
    students: fmtLimit(plan.students),
    storageGb: fmtLimit(plan.storageGb),
    fees: fmtBool(plan.fees),
    library: fmtBool(plan.library),
    behavioural: fmtBool(plan.behavioural),
    uniformInventory: fmtBool(plan.uniformInventory),
    whiteLabel: fmtBool(plan.whiteLabel),
    googleClassroom: fmtBool(plan.googleClassroom),
    trialStart: sub?.trialStartedAt ? fmtDate(sub.trialStartedAt) : '—',
    subscriptionStart: plan.periodStart ? fmtDate(plan.periodStart) : '—',
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

const ADDON_KEYS = [
  'fees',
  'library',
  'behavioural',
  'uniformInventory',
  'whiteLabel',
  'googleClassroom',
] as const

export function formDiffs(
  form: FormState,
  plan: AlmaActivePlanView | null,
  termTotal: number | null,
  sub: AlmaSubscriptionSnapshot | null = null
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

  const base: Record<string, boolean> = {
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
    branches: !limitEquals(
      limitFromForm(form.branchesUnlimited, form.branches),
      plan.branches
    ),
    students: !limitEquals(
      limitFromForm(form.studentsUnlimited, form.students),
      plan.students
    ),
    storageGb: !limitEquals(
      limitFromForm(form.storageGbUnlimited, form.storageGb),
      plan.storageGb
    ),
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

  for (const key of ADDON_KEYS) {
    base[key] = form[key] !== plan[key]
  }

  return base
}

export function offerNotesDiff(
  formNotes: string,
  savedNotes: string | null
): boolean {
  return (formNotes.trim() || null) !== (savedNotes?.trim() || null)
}
