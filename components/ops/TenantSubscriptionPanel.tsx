'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import type {
  RestoAdminEnv,
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
import ConfirmModal from '@/components/modals/ConfirmModal'
import styles from './TenantSubscription.module.css'

type CancelOfferDialog = {
  force: boolean
  title: string
  message: string
}

interface Props {
  tenantId: string
  tenantName: string
  env: RestoAdminEnv
}

type FormState = {
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
  /** Placeholder until Nest stores revenue share on the offer. */
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

function offerToForm(offer: RestoEnterpriseOfferInput): FormState {
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

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function minAccessDatetimeLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`
}

function formToOffer(form: FormState): RestoEnterpriseOfferInput | { error: string } {
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

  // Nest constraints: trial off → use setupFee, pre/post typically 0
  // trial on → setupFee 0 for activation path; still send all three for storage
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

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtLimit(v: LimitValue | number | null | undefined): string {
  if (v == null || v === 'unlimited') return 'Unlimited'
  return String(v)
}

function fmtBool(v: boolean | null | undefined): string {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '—'
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return (
    d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

const DEFAULT_OFFER: RestoEnterpriseOfferInput = {
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

function subHasSavedOffer(sub: RestoSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  return (
    sub.enterprisePrice != null &&
    Number.isFinite(sub.enterprisePrice) &&
    sub.enterprisePrice > 0
  )
}

/** Live Enterprise (offer accepted) — current snapshot present. */
function isEnterpriseLive(sub: RestoSubscriptionSnapshot | null): boolean {
  if (!sub) return false
  const base = normalizePlanBaseId(sub.planId)
  return base === 'enterprise' && sub.currentEnterprisePrice != null
}

/**
 * Nest DELETE returns 409 when plan is Enterprise OR current_enterprise_price is set
 * unless force=true.
 */
function needsEnterpriseClearForce(sub: RestoSubscriptionSnapshot | null): boolean {
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
function newOfferStatusLabel(sub: RestoSubscriptionSnapshot | null): string {
  if (!subHasSavedOffer(sub) || !sub) return ''

  if (!isEnterpriseLive(sub)) {
    return 'Pending'
  }

  // Live Enterprise: only pending if offer terms differ from accepted snapshot
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

  // Compare key offer limits to live snapshot when available
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
    // Setup fees on New are charges for this offer; 0 = no new charge.
    // Catalog/current setup stays visible in the Current column only.
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
function formOfferFromSubscription(
  sub: RestoSubscriptionSnapshot | null
): RestoEnterpriseOfferInput {
  if (!sub) return DEFAULT_OFFER

  const plan = resolveActivePlanView(sub)
  const pending = newOfferStatusLabel(sub)

  // Saved offer waiting for (re)acceptance — always show it in New
  if (subHasSavedOffer(sub) && pending) {
    return offerFromSaved(sub)
  }

  // Live Enterprise, offer accepted (status blank) → New draft = current live terms
  if (isEnterpriseLive(sub) && !pending) {
    return plan ? offerFromActivePlan(plan) : DEFAULT_OFFER
  }

  // Has a stored offer price even if status helper is empty (edge case)
  if (subHasSavedOffer(sub)) {
    return offerFromSaved(sub)
  }

  if (plan) return offerFromActivePlan(plan)
  return DEFAULT_OFFER
}

function limitField(
  form: FormState,
  valueKey: 'locations' | 'users' | 'counters' | 'ordersPerMonth',
  unlKey:
    | 'locationsUnlimited'
    | 'usersUnlimited'
    | 'countersUnlimited'
    | 'ordersUnlimited',
  patchForm: (p: Partial<FormState>) => void
) {
  return (
    <div className={styles.limitInner}>
      <input
        className={styles.inputSm}
        type="number"
        min={1}
        step={1}
        disabled={form[unlKey]}
        value={form[valueKey]}
        placeholder="∞"
        onChange={e =>
          patchForm({
            [valueKey]: e.target.value,
            [unlKey]: false,
          } as Partial<FormState>)
        }
      />
      <label className={styles.checkSm}>
        <input
          type="checkbox"
          checked={form[unlKey]}
          onChange={e =>
            patchForm({
              [unlKey]: e.target.checked,
              ...(e.target.checked ? { [valueKey]: '' } : {}),
            } as Partial<FormState>)
          }
        />
        ∞
      </label>
    </div>
  )
}

function currentValues(plan: ActivePlanView | null, sub: RestoSubscriptionSnapshot | null) {
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

type RowProps = {
  label: string
  newCell: React.ReactNode
  currentCell: React.ReactNode
  /** Highlight when New differs from Current */
  diff?: boolean
}

function CompareRow({ label, newCell, currentCell, diff }: RowProps) {
  const nameCls = diff
    ? `${styles.colName} ${styles.colNameDiff}`
    : styles.colName
  const newCls = diff ? `${styles.colNew} ${styles.colNewDiff}` : styles.colNew
  const curCls = diff ? `${styles.colCur} ${styles.colCurDiff}` : styles.colCur
  return (
    <>
      <div className={nameCls}>{label}</div>
      <div className={newCls}>{newCell}</div>
      <div className={curCls}>{currentCell}</div>
    </>
  )
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

function formDiffs(
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
      // Compare dates at minute precision via local values
      return (
        toLocalDatetimeValue(plan.accessStartsAt) !== form.accessStartsAt
      )
    })(),
    // Setup fees on the NEW offer: 0 = no charge this time (not a "change");
    // any amount > 0 = sales is charging a setup fee and rows highlight.
    // Only active fee inputs count (trial on ⇔ pre/post; trial off ⇔ setup).
    setupFee: !form.paidTrial && Number.isFinite(setupFee) && setupFee > 0,
    preTrial: form.paidTrial && Number.isFinite(preTrial) && preTrial > 0,
    postTrial: form.paidTrial && Number.isFinite(postTrial) && postTrial > 0,
  }
}

export default function TenantSubscriptionPanel({
  tenantId,
  tenantName,
  env,
}: Props) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [noSubYet, setNoSubYet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] =
    useState<RestoSubscriptionSnapshot | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(() => offerToForm(DEFAULT_OFFER))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = useState<CancelOfferDialog | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  const termTotalPreview = useMemo(() => {
    const monthly = Number(form.monthlyPrice)
    const months = Number(form.durationMonths)
    if (
      !Number.isFinite(monthly) ||
      monthly <= 0 ||
      !Number.isFinite(months) ||
      months <= 0
    ) {
      return null
    }
    return monthly * months
  }, [form.monthlyPrice, form.durationMonths])

  const accessMin = minAccessDatetimeLocal()
  const activePlan = useMemo(
    () => resolveActivePlanView(subscription),
    [subscription]
  )
  const current = useMemo(
    () => currentValues(activePlan, subscription),
    [activePlan, subscription]
  )
  const newStatus = useMemo(
    () => newOfferStatusLabel(subscription),
    [subscription]
  )
  const canCancelOffer = Boolean(newStatus)
  const needsForceCancel = needsEnterpriseClearForce(subscription)
  const diffs = useMemo(
    () => formDiffs(form, activePlan, termTotalPreview),
    [form, activePlan, termTotalPreview]
  )
  const setupFeePaidUsd = subscription?.setupFeePaidUsd ?? null

  const applySubscription = useCallback(
    (sub: RestoSubscriptionSnapshot | null, bodyNotes?: string[]) => {
      setSubscription(sub)
      if (bodyNotes) setNotes(bodyNotes)
      setForm(offerToForm(formOfferFromSubscription(sub)))
    },
    []
  )

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        setLoading(true)
        setLoadError(null)
      }
      setNoSubYet(false)
      try {
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription?env=${encodeURIComponent(env)}`,
          { cache: 'no-store' }
        )
        const body = await res.json().catch(() => ({}))
        if (res.status === 404) {
          setNoSubYet(true)
          applySubscription(null, [])
          setLoadError(null)
          return
        }
        if (!res.ok) {
          setLoadError(
            typeof body.error === 'string'
              ? body.error
              : `Failed to load subscription (${res.status})`
          )
          return
        }
        const sub = (body.subscription ?? null) as RestoSubscriptionSnapshot | null
        setNoSubYet(false)
        applySubscription(sub, Array.isArray(body.notes) ? body.notes : [])
      } catch {
        setLoadError(
          'Could not load subscription. Check connection and try again.'
        )
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [applySubscription, env, tenantId]
  )

  useEffect(() => {
    void load()
  }, [load])

  function patchForm(partial: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...partial }))
    setSavedMsg(null)
    setSaveError(null)
  }

  function requestCancelOffer() {
    setSaveError(null)
    setSavedMsg(null)
    const force = needsForceCancel
    setCancelDialog({
      force,
      title: force ? 'Cancel re-offer?' : 'Cancel pending offer?',
      message: force
        ? `This tenant already has live Enterprise terms. Cancel the pending re-offer only?\n\nLive plan, current Enterprise terms, Stripe, and total setup fees paid are kept.`
        : `Cancel the pending Enterprise offer for ${tenantName}?\n\nThis clears the sales offer only. The current plan is unchanged.`,
    })
  }

  function executeCancelOffer(force: boolean) {
    setSaveError(null)
    setSavedMsg(null)

    startTransition(async () => {
      async function doDelete(useForce: boolean) {
        const qs = new URLSearchParams({ env })
        if (useForce) qs.set('force', 'true')
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription/enterprise?${qs}`,
          {
            method: 'DELETE',
            headers: useForce
              ? { 'Content-Type': 'application/json' }
              : undefined,
            body: useForce ? JSON.stringify({ force: true }) : undefined,
          }
        )
        const body = await res.json().catch(() => ({}))
        return { res, body }
      }

      try {
        const { res, body } = await doDelete(force)

        // Nest 409: already Enterprise / has current_enterprise_price — need force
        if (res.status === 409 && !force) {
          setCancelDialog({
            force: true,
            title: 'Force cancel pending offer?',
            message: `${typeof body.error === 'string' ? body.error : 'This tenant has live Enterprise terms.'}\n\nCancel the pending offer only? Live plan and setup paid balance are kept.`,
          })
          return
        }

        if (!res.ok) {
          setCancelDialog(null)
          setSaveError(
            typeof body.error === 'string'
              ? body.error
              : `Cancel failed (${res.status})`
          )
          return
        }

        setCancelDialog(null)

        const notesFromDelete = Array.isArray(body.notes) ? body.notes : []
        if (body.subscription != null) {
          applySubscription(
            body.subscription as RestoSubscriptionSnapshot,
            notesFromDelete
          )
        } else {
          await load({ quiet: true })
          if (notesFromDelete.length) setNotes(notesFromDelete)
        }

        setSavedMsg(
          body.cleared
            ? 'Pending offer cancelled. Current plan and live terms unchanged.'
            : 'No pending offer to cancel.'
        )
      } catch {
        setCancelDialog(null)
        setSaveError('Could not cancel offer. Check connection and try again.')
      }
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSavedMsg(null)
    const offer = formToOffer(form)
    if ('error' in offer) {
      setSaveError(offer.error)
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription/enterprise?env=${encodeURIComponent(env)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(offer),
          }
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSaveError(
            typeof body.error === 'string'
              ? body.error
              : `Save failed (${res.status})`
          )
          return
        }

        let sub = (body.subscription ?? null) as RestoSubscriptionSnapshot | null
        // Confirm Nest actually wrote offer fields (not only HTTP 200)
        if (!sub || !subHasSavedOffer(sub)) {
          // Re-fetch once in case response body was partial
          const reload = await fetch(
            `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription?env=${encodeURIComponent(env)}`,
            { cache: 'no-store' }
          )
          const reloadBody = await reload.json().catch(() => ({}))
          sub = (reloadBody.subscription ?? null) as RestoSubscriptionSnapshot | null
        }

        if (!sub || !subHasSavedOffer(sub)) {
          setSaveError(
            'Server returned success but no Enterprise offer was stored. Check Nest admin API / DB.'
          )
          return
        }

        // Term price must match what we sent (allow tiny float noise)
        if (
          sub.enterprisePrice != null &&
          Math.abs(Number(sub.enterprisePrice) - offer.price) > 0.05
        ) {
          setSaveError(
            `Offer stored with price ${sub.enterprisePrice}, expected ${offer.price}. Reload and verify.`
          )
        }

        applySubscription(
          sub,
          Array.isArray(body.notes) ? body.notes : []
        )
        setNoSubYet(false)

        // Refresh full snapshot (current plan + live terms) after write
        await load({ quiet: true })

        const livePlan = sub.planId ?? 'unknown'
        setSavedMsg(
          `Offer saved and pending. Current plan stays “${livePlan}” until the tenant accepts (portal / Apply terms) — only the New column is updated by Save.`
        )
      } catch {
        setSaveError('Could not save. Check connection and try again.')
      }
    })
  }

  if (loading) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Loading subscription…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.title}>Subscription</h3>
        <p className={styles.error} role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form className={styles.panel} onSubmit={handleSave}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>Subscription — {tenantName}</h3>
          <p className={styles.subline}>
            New: Enterprise sales offer. Current: live plan. Setup fees on New
            are charges for this offer (0 = no charge, not compared to prior).
            Highlighted rows differ / are charging. Total setup charged = lifetime
            paid to date (from API when available).
            {noSubYet
              ? ' No subscription yet — save creates a free shell.'
              : ''}
            {newStatus
              ? ` Offer status: ${newStatus}.`
              : !subHasSavedOffer(subscription) && subscription
                ? ' New is prefilled from current until you save an offer.'
                : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void load()}
            disabled={isPending}
          >
            Reload
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={isPending || !canCancelOffer}
            title={
              !canCancelOffer
                ? 'No pending Enterprise offer to cancel'
                : needsForceCancel
                  ? 'Cancel pending re-offer (tenant already on Enterprise)'
                  : 'Cancel pending Enterprise offer'
            }
            onClick={() => requestCancelOffer()}
          >
            Cancel pending offer
          </button>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : 'Save offer'}
          </button>
        </div>
      </div>

      <div className={styles.compareScroll}>
        <div className={styles.compare}>
          <div className={styles.headName} />
          <div className={styles.headNew}>New offer</div>
          <div className={styles.headCur}>Current plan</div>

          <CompareRow
            label="Plan"
            newCell={
              <span className={styles.mutedVal}>Enterprise offer</span>
            }
            currentCell={current.plan}
          />
          <CompareRow
            label="Status"
            newCell={
              newStatus ? (
                <span className={styles.pendingBadge}>{newStatus}</span>
              ) : (
                <span className={styles.mutedVal}>—</span>
              )
            }
            currentCell={current.status}
          />
          <CompareRow
            label="Recurring (USD/mo)"
            diff={diffs.monthly}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0.01}
                step="any"
                value={form.monthlyPrice}
                onChange={e => patchForm({ monthlyPrice: e.target.value })}
                required
              />
            }
            currentCell={current.monthly}
          />
          <CompareRow
            label="Duration (mo)"
            diff={diffs.duration}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={1}
                step={1}
                value={form.durationMonths}
                onChange={e => patchForm({ durationMonths: e.target.value })}
                required
              />
            }
            currentCell={current.duration}
          />
          <CompareRow
            label="Term total"
            diff={diffs.termTotal}
            newCell={
              <strong>
                {termTotalPreview != null ? fmtMoney(termTotalPreview) : '—'}
              </strong>
            }
            currentCell={current.termTotal}
          />
          <CompareRow
            label="Branches"
            diff={diffs.locations}
            newCell={limitField(
              form,
              'locations',
              'locationsUnlimited',
              patchForm
            )}
            currentCell={current.locations}
          />
          <CompareRow
            label="Users"
            diff={diffs.users}
            newCell={limitField(form, 'users', 'usersUnlimited', patchForm)}
            currentCell={current.users}
          />
          <CompareRow
            label="Counters"
            diff={diffs.counters}
            newCell={limitField(
              form,
              'counters',
              'countersUnlimited',
              patchForm
            )}
            currentCell={current.counters}
          />
          <CompareRow
            label="Orders / mo"
            diff={diffs.orders}
            newCell={limitField(
              form,
              'ordersPerMonth',
              'ordersUnlimited',
              patchForm
            )}
            currentCell={current.orders}
          />
          {(
            [
              {
                key: 'callCenter' as const,
                feeKey: 'callCenterFee' as const,
                label: 'Call center',
              },
              {
                key: 'kds' as const,
                feeKey: 'kdsFee' as const,
                label: 'KDS',
              },
              {
                key: 'inventory' as const,
                feeKey: 'inventoryFee' as const,
                label: 'Inventory',
              },
              {
                key: 'support' as const,
                feeKey: 'supportFee' as const,
                label: 'Operation Support',
              },
              {
                key: 'webOrdering' as const,
                feeKey: 'webOrderingFee' as const,
                label: 'Web ordering',
              },
            ] as const
          ).map(({ key, feeKey, label }) => (
            <CompareRow
              key={key}
              label={label}
              diff={diffs[key]}
              newCell={
                <div className={styles.addonCol}>
                  <label className={styles.checkSm}>
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => {
                        const on = e.target.checked
                        patchForm({
                          [key]: on,
                          ...(on
                            ? {}
                            : key === 'webOrdering'
                              ? {
                                  [feeKey]: '',
                                  webOrderingRevenuePercent: '',
                                }
                              : { [feeKey]: '' }),
                        })
                      }}
                    />
                    {form[key] ? 'Yes' : 'No'}
                  </label>
                  {form[key] && (
                    <>
                      <input
                        className={styles.inputSm}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="$ / mo (Nest TBD)"
                        value={form[feeKey]}
                        onChange={e =>
                          patchForm({ [feeKey]: e.target.value })
                        }
                        title="Monthly add-on fee — stored in Reach UI only until Nest accepts fee fields"
                      />
                      {key === 'webOrdering' && (
                        <input
                          className={styles.inputSm}
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          placeholder="% revenue (Nest TBD)"
                          value={form.webOrderingRevenuePercent}
                          onChange={e =>
                            patchForm({
                              webOrderingRevenuePercent: e.target.value,
                            })
                          }
                          title="Revenue share for month-end invoice — Nest placeholder"
                        />
                      )}
                    </>
                  )}
                </div>
              }
              currentCell={
                key === 'callCenter'
                  ? current.callCenter
                  : key === 'kds'
                    ? current.kds
                    : key === 'inventory'
                      ? current.inventory
                      : key === 'support'
                        ? current.support
                        : current.webOrdering
              }
            />
          ))}
          <CompareRow
            label="Paid trial"
            diff={diffs.paidTrial}
            newCell={
              <label className={styles.checkSm}>
                <input
                  type="checkbox"
                  checked={form.paidTrial}
                  onChange={e => {
                    const paidTrial = e.target.checked
                    if (paidTrial) {
                      patchForm({
                        paidTrial: true,
                        accessStartsEmpty: true,
                        accessStartsAt: '',
                      })
                    } else {
                      patchForm({
                        paidTrial: false,
                        paidTrialDays: '',
                      })
                    }
                  }}
                />
                {form.paidTrial ? 'Yes' : 'No'}
              </label>
            }
            currentCell={current.paidTrial}
          />
          <CompareRow
            label="Trial days"
            diff={diffs.trialDays}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={1}
                step={1}
                disabled={!form.paidTrial}
                value={form.paidTrialDays}
                onChange={e => patchForm({ paidTrialDays: e.target.value })}
              />
            }
            currentCell={current.trialDays}
          />
          <CompareRow
            label="Access starts"
            diff={diffs.accessStarts}
            newCell={
              <div className={styles.accessStack}>
                <label className={styles.checkSm}>
                  <input
                    type="checkbox"
                    checked={form.accessStartsEmpty}
                    disabled={form.paidTrial}
                    onChange={e =>
                      patchForm({
                        accessStartsEmpty: e.target.checked,
                        ...(e.target.checked ? { accessStartsAt: '' } : {}),
                      })
                    }
                  />
                  Immediate
                </label>
                <input
                  className={styles.inputAccess}
                  type="datetime-local"
                  min={accessMin}
                  disabled={form.paidTrial || form.accessStartsEmpty}
                  value={form.accessStartsAt}
                  onChange={e => {
                    const v = e.target.value
                    if (v && v < accessMin) {
                      setSaveError('Access starts cannot be before today')
                      return
                    }
                    patchForm({ accessStartsAt: v, accessStartsEmpty: false })
                  }}
                />
              </div>
            }
            currentCell={current.accessStarts}
          />
          <CompareRow
            label="Setup fee"
            diff={diffs.setupFee}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={form.paidTrial}
                value={form.setupFee}
                onChange={e => patchForm({ setupFee: e.target.value })}
              />
            }
            currentCell={current.setupFee}
          />
          <CompareRow
            label="Pre-trial setup"
            diff={diffs.preTrial}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={!form.paidTrial}
                value={form.preTrialSetupFee}
                onChange={e => patchForm({ preTrialSetupFee: e.target.value })}
              />
            }
            currentCell={current.preTrial}
          />
          <CompareRow
            label="Post-trial setup"
            diff={diffs.postTrial}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={!form.paidTrial}
                value={form.postTrialSetupFee}
                onChange={e =>
                  patchForm({ postTrialSetupFee: e.target.value })
                }
              />
            }
            currentCell={current.postTrial}
          />
          <CompareRow
            label="Total setup fees paid"
            newCell={
              <span
                className={styles.mutedVal}
                title="Read-only Nest field setupFeePaidUsd — not sent on PUT"
              >
                {setupFeePaidUsd != null
                  ? fmtMoney(setupFeePaidUsd)
                  : '—'}
              </span>
            }
            currentCell={
              setupFeePaidUsd != null ? (
                <span title="Regular + pre-trial + post-trial setup already collected">
                  {fmtMoney(setupFeePaidUsd)}
                </span>
              ) : (
                <span className={styles.placeholderVal}>—</span>
              )
            }
          />
          <CompareRow
            label="Billing period"
            newCell={<span className={styles.mutedVal}>After activation</span>}
            currentCell={current.period}
          />
        </div>
      </div>

      {(notes.length > 0 || (subscription?.warnings?.length ?? 0) > 0) && (
        <div className={styles.notesBlock}>
          {notes.map((n, i) => (
            <span key={`n-${i}`} className={styles.noteChip}>
              {n}
            </span>
          ))}
          {(subscription?.warnings ?? []).map((w, i) => (
            <span key={`w-${i}`} className={styles.warnChip}>
              {w}
            </span>
          ))}
        </div>
      )}

      {saveError && (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      )}
      {savedMsg && !saveError && (
        <p className={styles.success} role="status">
          {savedMsg}
        </p>
      )}

      {cancelDialog && (
        <ConfirmModal
          title={cancelDialog.title}
          message={cancelDialog.message}
          confirmLabel={
            cancelDialog.force ? 'Cancel pending offer' : 'Cancel offer'
          }
          danger
          loading={isPending}
          onConfirm={() => executeCancelOffer(cancelDialog.force)}
          onClose={() => {
            if (!isPending) setCancelDialog(null)
          }}
        />
      )}
    </form>
  )
}
