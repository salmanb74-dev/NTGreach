/**
 * Shared Resto Enterprise-style quote parameters for CRM:
 * lead Deal Values → contract/quotation {{variables}}.
 * Aligned with ops TenantSubscriptionPanel / Nest enterprise offer.
 */

import { formatAmount } from '@/lib/currency'
import { resolveCurrencyDisplay } from '@/lib/currency-display'

export type QuotedLimit = number | null // null + unlimited flag → Unlimited

export type BillingCycle = 'monthly' | 'annual'

/** Canonical starter commercial terms (TS source of truth for app defaults). */
export const STARTER_PLATFORM_FEE = 35
export const STARTER_SETUP_FEE = 350
export const STARTER_LOCATIONS = 1
export const STARTER_USERS = 50
export const STARTER_COUNTERS = 2
export const STARTER_ORDERS_PER_MONTH = 3000
export const STARTER_CURRENCY = 'USD'
export const DEFAULT_PAID_TRIAL_DAYS = 14
export const QUOTATION_VALIDITY_DAYS = 30
export const SAVE_FLASH_MS = 2000
export const TEMPLATE_DATE_LOCALE = 'en-GB'

export function monthsForBillingCycle(cycle: BillingCycle): number {
  return cycle === 'annual' ? 12 : 1
}

export function billingCycleFromStored(opts: {
  billingCycle?: unknown
  durationMonths?: number | null
  paymentFrequency?: unknown
}): BillingCycle {
  const raw = opts.billingCycle
  if (raw === 'annual' || raw === 'monthly') return raw
  if (opts.paymentFrequency === 'annual') return 'annual'
  if (opts.paymentFrequency === 'monthly') return 'monthly'
  if (opts.durationMonths != null && opts.durationMonths >= 12) return 'annual'
  return 'monthly'
}

export function fmtBillingCycle(cycle: BillingCycle): string {
  return cycle === 'annual' ? 'Annual' : 'Monthly'
}

export function contractTermLabel(cycle: BillingCycle): string {
  return cycle === 'annual' ? '12 months' : '1 month'
}

export function formatTemplateDate(d: Date | string | null | undefined): string {
  if (d == null || d === '') return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(TEMPLATE_DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function numStr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return ''
  return String(v)
}

export function parseOptNum(s: string): number | null {
  if (!s.trim()) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export type FeatureAddonKey =
  | 'callCenter'
  | 'kds'
  | 'inventory'
  | 'support'
  | 'webOrdering'

export type FeatureAddonDef = {
  key: FeatureAddonKey
  feeKey:
    | 'callCenterFee'
    | 'kdsFee'
    | 'inventoryFee'
    | 'supportFee'
    | 'webOrderingFee'
  label: string
}

/** Feature toggles + monthly fee fields (Deal Panel + Settings defaults). */
export const FEATURE_ADDONS: readonly FeatureAddonDef[] = [
  { key: 'callCenter', feeKey: 'callCenterFee', label: 'Call center' },
  { key: 'kds', feeKey: 'kdsFee', label: 'Kitchen display (KDS)' },
  { key: 'inventory', feeKey: 'inventoryFee', label: 'Inventory' },
  { key: 'support', feeKey: 'supportFee', label: 'Ops support' },
  { key: 'webOrdering', feeKey: 'webOrderingFee', label: 'Web ordering' },
] as const

export type QuotedSubscription = {
  /** Platform fee charged per month (stored as monthlyPrice for Nest/legacy). */
  monthlyPrice: number | null
  billingCycle: BillingCycle
  /** Derived from billingCycle: 1 monthly, 12 annual. Kept for stored JSON. */
  durationMonths: number | null
  setupFee: number | null
  locations: number | null
  locationsUnlimited: boolean
  users: number | null
  usersUnlimited: boolean
  counters: number | null
  countersUnlimited: boolean
  ordersPerMonth: number | null
  ordersUnlimited: boolean
  /** Feature on/off — monthly $ add to platform fee when on. */
  callCenter: boolean
  callCenterFee: number | null
  kds: boolean
  kdsFee: number | null
  inventory: boolean
  inventoryFee: number | null
  support: boolean
  supportFee: number | null
  webOrdering: boolean
  webOrderingFee: number | null
  /** % of revenue on month-end invoice (web ordering). Nest placeholder. */
  webOrderingRevenuePercent: number | null
  paidTrial: boolean
  paidTrialDays: number | null
  preTrialSetupFee: number | null
  postTrialSetupFee: number | null
}

export const EMPTY_QUOTED_SUBSCRIPTION: QuotedSubscription = {
  monthlyPrice: null,
  billingCycle: 'monthly',
  durationMonths: 1,
  setupFee: null,
  locations: null,
  locationsUnlimited: false,
  users: null,
  usersUnlimited: false,
  counters: null,
  countersUnlimited: false,
  ordersPerMonth: null,
  ordersUnlimited: false,
  callCenter: false,
  callCenterFee: null,
  kds: false,
  kdsFee: null,
  inventory: false,
  inventoryFee: null,
  support: false,
  supportFee: null,
  webOrdering: false,
  webOrderingFee: null,
  webOrderingRevenuePercent: null,
  paidTrial: false,
  paidTrialDays: null,
  preTrialSetupFee: null,
  postTrialSetupFee: null,
}

/**
 * Built-in defaults = Starter plan commercial terms.
 * Overridden by app_settings.deal_quote_defaults when set.
 */
export const STARTER_QUOTED_SUBSCRIPTION: QuotedSubscription = {
  monthlyPrice: STARTER_PLATFORM_FEE,
  billingCycle: 'monthly',
  durationMonths: 1,
  setupFee: STARTER_SETUP_FEE,
  locations: STARTER_LOCATIONS,
  locationsUnlimited: false,
  users: STARTER_USERS,
  usersUnlimited: false,
  counters: STARTER_COUNTERS,
  countersUnlimited: false,
  ordersPerMonth: STARTER_ORDERS_PER_MONTH,
  ordersUnlimited: false,
  callCenter: false,
  callCenterFee: null,
  kds: false,
  kdsFee: null,
  inventory: false,
  inventoryFee: null,
  support: false,
  supportFee: null,
  webOrdering: false,
  webOrderingFee: null,
  webOrderingRevenuePercent: null,
  paidTrial: false,
  paidTrialDays: null,
  preTrialSetupFee: 0,
  postTrialSetupFee: 0,
}

/** Sum of enabled feature monthly $ fees (excludes base platform fee). */
export function addonMonthlyFees(sub: QuotedSubscription): number {
  let total = 0
  for (const addon of FEATURE_ADDONS) {
    if (sub[addon.key]) total += sub[addon.feeKey] ?? 0
  }
  return total
}

/** Base platform fee + enabled addon monthly fees. */
export function totalMonthlyRecurring(sub: QuotedSubscription): number {
  return (sub.monthlyPrice ?? 0) + addonMonthlyFees(sub)
}

/**
 * Normalize subscription before DB save (paid trial, unlimited limits, disabled addons).
 */
export function normalizeQuotedSubscriptionForSave(
  sub: QuotedSubscription,
  billingCycle: BillingCycle = sub.billingCycle
): QuotedSubscription {
  return {
    ...sub,
    billingCycle,
    durationMonths: monthsForBillingCycle(billingCycle),
    setupFee: sub.paidTrial ? 0 : sub.setupFee,
    preTrialSetupFee: sub.paidTrial ? sub.preTrialSetupFee : 0,
    postTrialSetupFee: sub.paidTrial ? sub.postTrialSetupFee : 0,
    paidTrialDays: sub.paidTrial ? sub.paidTrialDays : null,
    locations: sub.locationsUnlimited ? null : sub.locations,
    users: sub.usersUnlimited ? null : sub.users,
    counters: sub.countersUnlimited ? null : sub.counters,
    ordersPerMonth: sub.ordersUnlimited ? null : sub.ordersPerMonth,
    callCenterFee: sub.callCenter ? sub.callCenterFee : null,
    kdsFee: sub.kds ? sub.kdsFee : null,
    inventoryFee: sub.inventory ? sub.inventoryFee : null,
    supportFee: sub.support ? sub.supportFee : null,
    webOrderingFee: sub.webOrdering ? sub.webOrderingFee : null,
    webOrderingRevenuePercent: sub.webOrdering
      ? sub.webOrderingRevenuePercent
      : null,
  }
}

/** Setup fees in force + one billing cycle of recurring (before discount/tax). */
export function estimateFirstPaymentBase(sub: QuotedSubscription): {
  setupFees: number
  cycleRecurring: number
  total: number
} {
  const monthly = totalMonthlyRecurring(sub)
  const months = monthsForBillingCycle(sub.billingCycle)
  const setup = sub.paidTrial ? 0 : sub.setupFee ?? 0
  const pre = sub.paidTrial ? sub.preTrialSetupFee ?? 0 : 0
  const post = sub.paidTrial ? sub.postTrialSetupFee ?? 0 : 0
  const setupFees = setup + pre + post
  const cycleRecurring = monthly * months
  return { setupFees, cycleRecurring, total: setupFees + cycleRecurring }
}

export type DealQuoteDefaults = {
  currency: string
  billingCycle: BillingCycle
  subscription: QuotedSubscription
}

export const STARTER_DEAL_QUOTE_DEFAULTS: DealQuoteDefaults = {
  currency: STARTER_CURRENCY,
  billingCycle: 'monthly',
  subscription: { ...STARTER_QUOTED_SUBSCRIPTION },
}

export const DEAL_QUOTE_DEFAULTS_SETTING_KEY = 'deal_quote_defaults'

export function parseDealQuoteDefaults(raw: unknown): DealQuoteDefaults {
  const base = {
    currency: STARTER_DEAL_QUOTE_DEFAULTS.currency,
    billingCycle: STARTER_DEAL_QUOTE_DEFAULTS.billingCycle,
    subscription: { ...STARTER_QUOTED_SUBSCRIPTION },
  }

  if (raw == null || raw === '') return base

  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return base
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>
  } else {
    return base
  }

  const currency =
    typeof obj.currency === 'string' && obj.currency.trim()
      ? obj.currency.trim().toUpperCase()
      : base.currency

  const subRaw =
    obj.subscription && typeof obj.subscription === 'object'
      ? (obj.subscription as Record<string, unknown>)
      : obj

  const parsed = parseQuotedSubscription({
    ...STARTER_QUOTED_SUBSCRIPTION,
    ...subRaw,
  })

  const billingCycle = billingCycleFromStored({
    billingCycle: obj.billingCycle ?? obj.billing_cycle ?? parsed.billingCycle,
    durationMonths: parsed.durationMonths,
    paymentFrequency: obj.paymentFrequency ?? obj.payment_frequency,
  })

  return {
    currency,
    billingCycle,
    subscription: {
      ...STARTER_QUOTED_SUBSCRIPTION,
      ...parsed,
      billingCycle,
      durationMonths: monthsForBillingCycle(billingCycle),
      monthlyPrice:
        parsed.monthlyPrice ?? STARTER_QUOTED_SUBSCRIPTION.monthlyPrice,
      setupFee: parsed.setupFee ?? STARTER_QUOTED_SUBSCRIPTION.setupFee,
      locations: parsed.locations ?? STARTER_QUOTED_SUBSCRIPTION.locations,
      users: parsed.users ?? STARTER_QUOTED_SUBSCRIPTION.users,
      counters: parsed.counters ?? STARTER_QUOTED_SUBSCRIPTION.counters,
      ordersPerMonth:
        parsed.ordersPerMonth ?? STARTER_QUOTED_SUBSCRIPTION.ordersPerMonth,
    },
  }
}

/** Flatten defaults for leads insert / deal panel. */
export function leadFieldsFromDealDefaults(d: DealQuoteDefaults) {
  const subscription = normalizeQuotedSubscriptionForSave(
    { ...d.subscription, billingCycle: d.billingCycle },
    d.billingCycle
  )
  return {
    deal_currency: d.currency,
    quoted_mrr: totalMonthlyRecurring(subscription),
    quoted_setup_fee: subscription.setupFee,
    payment_frequency: d.billingCycle,
    quoted_subscription: subscription as unknown as Record<string, unknown>,
  }
}

export function serializeDealQuoteDefaults(d: DealQuoteDefaults): string {
  return JSON.stringify({
    currency: d.currency,
    billingCycle: d.billingCycle,
    subscription: {
      ...d.subscription,
      billingCycle: d.billingCycle,
      durationMonths: monthsForBillingCycle(d.billingCycle),
    },
  })
}

/** Serialized Starter defaults for SQL seeds — run `npm run sync:deal-defaults-sql` after changing STARTER_* */
export const DEAL_QUOTE_DEFAULTS_JSON = serializeDealQuoteDefaults(
  STARTER_DEAL_QUOTE_DEFAULTS
)

/** Template {{key}} definitions for subscription rows (contracts + quotations). */
export const SUBSCRIPTION_TEMPLATE_VARIABLES = [
  {
    key: 'platform_fee',
    label: 'Platform fee',
    example: String(STARTER_PLATFORM_FEE),
  },
  { key: 'billing_cycle', label: 'Billing cycle', example: 'Monthly' },
  {
    key: 'setup_fee',
    label: 'Setup fee',
    example: String(STARTER_SETUP_FEE),
  },
  { key: 'pre_trial_setup_fee', label: 'Pre-trial setup', example: '0' },
  {
    key: 'post_trial_setup_fee',
    label: 'Post-trial setup',
    example: String(STARTER_SETUP_FEE),
  },
  { key: 'branches', label: 'Branches', example: String(STARTER_LOCATIONS) },
  { key: 'users', label: 'Users', example: String(STARTER_USERS) },
  { key: 'counters', label: 'Counters', example: String(STARTER_COUNTERS) },
  {
    key: 'orders_per_month',
    label: 'Orders / month',
    example: String(STARTER_ORDERS_PER_MONTH),
  },
  { key: 'call_center', label: 'Call center / mo', example: '15' },
  { key: 'kds', label: 'Kitchen display / mo', example: '10' },
  { key: 'inventory', label: 'Inventory / mo', example: '12' },
  { key: 'ops_support', label: 'Ops support / mo', example: '25' },
  { key: 'web_ordering', label: 'Web ordering / mo', example: '20' },
  {
    key: 'web_ordering_revenue_pct',
    label: 'Web ordering revenue %',
    example: '2.5',
  },
  { key: 'paid_trial', label: 'Paid trial', example: 'Yes' },
  {
    key: 'paid_trial_days',
    label: 'Trial days',
    example: String(DEFAULT_PAID_TRIAL_DAYS),
  },
  { key: 'trial_starts', label: 'Trial starts', example: '1 January 2026' },
] as const

export const SUBSCRIPTION_DEAL_KEYS = new Set([
  ...SUBSCRIPTION_TEMPLATE_VARIABLES.map(v => v.key),
  // legacy tokens still substituted in old templates
  'locations',
  'monthly_price',
  'recurring_fee',
  'duration_months',
  'term_total',
  'payment_frequency',
  'contract_term',
  'support',
  'access_starts',
])

function parseFeatureAddon(
  enabledRaw: unknown,
  feeRaw: unknown
): { enabled: boolean; fee: number | null } {
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  // Legacy: field was a bare number meaning the monthly fee
  if (typeof enabledRaw === 'number' && Number.isFinite(enabledRaw)) {
    return { enabled: enabledRaw > 0, fee: enabledRaw }
  }
  if (typeof enabledRaw === 'string' && enabledRaw.trim() !== '') {
    const n = Number(enabledRaw)
    if (Number.isFinite(n) && enabledRaw !== 'true' && enabledRaw !== 'false') {
      return { enabled: n > 0, fee: n }
    }
  }
  const fee = num(feeRaw)
  if (typeof enabledRaw === 'boolean') {
    return { enabled: enabledRaw, fee }
  }
  if (fee != null && fee > 0) {
    return { enabled: true, fee }
  }
  return { enabled: false, fee }
}

export function parseQuotedSubscription(raw: unknown): QuotedSubscription {
  let value = raw
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return { ...EMPTY_QUOTED_SUBSCRIPTION }
    try {
      value = JSON.parse(trimmed)
    } catch {
      return { ...EMPTY_QUOTED_SUBSCRIPTION }
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_QUOTED_SUBSCRIPTION }
  }
  const r = value as Record<string, unknown>
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const bool = (v: unknown, fallback = false) =>
    typeof v === 'boolean' ? v : fallback

  const durationMonthsRaw = num(r.durationMonths ?? r.duration_months)
  const billingCycle = billingCycleFromStored({
    billingCycle: r.billingCycle ?? r.billing_cycle,
    durationMonths: durationMonthsRaw,
    paymentFrequency: r.paymentFrequency ?? r.payment_frequency,
  })

  const callCenter = parseFeatureAddon(
    r.callCenter ?? r.call_center,
    r.callCenterFee ?? r.call_center_fee
  )
  const kds = parseFeatureAddon(r.kds, r.kdsFee ?? r.kds_fee)
  const inventory = parseFeatureAddon(
    r.inventory,
    r.inventoryFee ?? r.inventory_fee
  )
  const support = parseFeatureAddon(
    r.support,
    r.supportFee ?? r.support_fee
  )
  const webOrdering = parseFeatureAddon(
    r.webOrdering ?? r.web_ordering,
    r.webOrderingFee ?? r.web_ordering_fee
  )

  return {
    monthlyPrice: num(
      r.monthlyPrice ?? r.monthly_price ?? r.platformFee ?? r.platform_fee
    ),
    billingCycle,
    durationMonths: monthsForBillingCycle(billingCycle),
    setupFee: num(r.setupFee ?? r.setup_fee),
    locations: num(r.locations),
    locationsUnlimited: bool(r.locationsUnlimited ?? r.locations_unlimited),
    users: num(r.users),
    usersUnlimited: bool(r.usersUnlimited ?? r.users_unlimited),
    counters: num(r.counters),
    countersUnlimited: bool(r.countersUnlimited ?? r.counters_unlimited),
    ordersPerMonth: num(r.ordersPerMonth ?? r.orders_per_month),
    ordersUnlimited: bool(r.ordersUnlimited ?? r.orders_unlimited),
    callCenter: callCenter.enabled,
    callCenterFee: callCenter.fee,
    kds: kds.enabled,
    kdsFee: kds.fee,
    inventory: inventory.enabled,
    inventoryFee: inventory.fee,
    support: support.enabled,
    supportFee: support.fee,
    webOrdering: webOrdering.enabled,
    webOrderingFee: webOrdering.fee,
    webOrderingRevenuePercent: num(
      r.webOrderingRevenuePercent ?? r.web_ordering_revenue_percent
    ),
    paidTrial: bool(r.paidTrial ?? r.paid_trial),
    paidTrialDays: num(r.paidTrialDays ?? r.paid_trial_days),
    preTrialSetupFee: num(r.preTrialSetupFee ?? r.pre_trial_setup_fee),
    postTrialSetupFee: num(r.postTrialSetupFee ?? r.post_trial_setup_fee),
  }
}

export function termTotal(
  monthly: number | null | undefined,
  months: number | null | undefined
): number | null {
  if (monthly == null || months == null) return null
  if (!Number.isFinite(monthly) || !Number.isFinite(months) || months <= 0) {
    return null
  }
  return monthly * months
}

function fmtLimit(
  value: number | null | undefined,
  unlimited: boolean
): string {
  if (unlimited) return 'Unlimited'
  if (value == null) return ''
  return String(value)
}

/** Enabled feature → monthly $ string; otherwise blank (row omitted in templates). */
function fmtAddonFee(
  enabled: boolean,
  fee: number | null | undefined
): string {
  if (!enabled) return ''
  return formatAmount(fee ?? 0)
}

function fmtPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n)
}

function formatAccessDate(iso: string | null | undefined): string {
  return formatTemplateDate(iso)
}

export type LeadQuoteSource = {
  company_name?: string
  contact_name?: string
  email?: string | null
  address?: string | null
  quoted_setup_fee?: number | null
  quoted_mrr?: number | null
  payment_frequency?: string | null
  deal_currency?: string | null
  discount?: number | null
  tax_rate?: number | null
  payment_start_date?: string | null
  quoted_subscription?: unknown
}

/**
 * Resolve a lead’s quoted subscription the same way Deal Panel does:
 * parse JSON (object or string) + fall back to lead fee / frequency columns.
 */
export function hydrateQuotedSubscriptionFromLead(
  lead: LeadQuoteSource
): QuotedSubscription {
  const fromStored = parseQuotedSubscription(lead.quoted_subscription)
  const billingCycle = billingCycleFromStored({
    billingCycle: fromStored.billingCycle,
    durationMonths: fromStored.durationMonths,
    paymentFrequency: lead.payment_frequency,
  })
  const parsed: QuotedSubscription = {
    ...fromStored,
    billingCycle,
    durationMonths: monthsForBillingCycle(billingCycle),
  }

  if (parsed.monthlyPrice == null && lead.quoted_mrr != null) {
    const addons = addonMonthlyFees(parsed)
    parsed.monthlyPrice = Math.max(0, Number(lead.quoted_mrr) - addons)
  }
  if (parsed.setupFee == null && lead.quoted_setup_fee != null) {
    parsed.setupFee = lead.quoted_setup_fee
  }
  return parsed
}

/** Merge lead row + quoted_subscription into template variable strings. */
export function subscriptionVarsFromLead(
  lead: LeadQuoteSource,
  inputCurrency: string,
  currencyLabels?: Record<string, string> | null
): Record<string, string> {
  const sub = hydrateQuotedSubscriptionFromLead(lead)
  const baseMonthly = sub.monthlyPrice
  const totalMonthly =
    baseMonthly != null || addonMonthlyFees(sub) > 0
      ? totalMonthlyRecurring({
          ...sub,
          monthlyPrice: baseMonthly ?? 0,
        })
      : lead.quoted_mrr ?? null
  const cycle = billingCycleFromStored({
    billingCycle: sub.billingCycle,
    durationMonths: sub.durationMonths,
    paymentFrequency: lead.payment_frequency,
  })
  const months = monthsForBillingCycle(cycle)
  const setup = sub.setupFee ?? lead.quoted_setup_fee ?? null
  const total = termTotal(totalMonthly, months)

  const preSetup = sub.paidTrial ? sub.preTrialSetupFee : null
  const postSetup = sub.paidTrial ? sub.postTrialSetupFee : null
  const setupDisplay = sub.paidTrial ? 0 : setup
  const trialStarts = formatAccessDate(lead.payment_start_date)
  const branches = fmtLimit(sub.locations, sub.locationsUnlimited)
  const opsSupport = fmtAddonFee(sub.support, sub.supportFee)
  const platformFee = formatAmount(baseMonthly)
  // Hide setup row when paid trial (fee is 0); show pre/post instead.
  const setupFeeVar = sub.paidTrial
    ? ''
    : formatAmount(setupDisplay ?? setup)

  const currencyCode = lead.deal_currency ?? inputCurrency

  return {
    currency: resolveCurrencyDisplay(currencyCode, currencyLabels),
    platform_fee: platformFee,
    billing_cycle: fmtBillingCycle(cycle),
    setup_fee: setupFeeVar,
    pre_trial_setup_fee: formatAmount(preSetup),
    post_trial_setup_fee: formatAmount(postSetup),
    branches,
    users: fmtLimit(sub.users, sub.usersUnlimited),
    counters: fmtLimit(sub.counters, sub.countersUnlimited),
    orders_per_month: fmtLimit(sub.ordersPerMonth, sub.ordersUnlimited),
    call_center: fmtAddonFee(sub.callCenter, sub.callCenterFee),
    kds: fmtAddonFee(sub.kds, sub.kdsFee),
    inventory: fmtAddonFee(sub.inventory, sub.inventoryFee),
    ops_support: opsSupport,
    web_ordering: fmtAddonFee(sub.webOrdering, sub.webOrderingFee),
    web_ordering_revenue_pct: sub.webOrdering
      ? fmtPercent(sub.webOrderingRevenuePercent)
      : '',
    paid_trial: sub.paidTrial ? 'Yes' : '',
    paid_trial_days:
      sub.paidTrial && sub.paidTrialDays != null
        ? String(sub.paidTrialDays)
        : '',
    trial_starts: sub.paidTrial ? trialStarts : '',
    // aliases for older templates
    monthly_price: platformFee,
    recurring_fee: formatAmount(totalMonthly) || platformFee,
    duration_months: String(months),
    term_total: formatAmount(total),
    locations: branches,
    support: opsSupport,
    access_starts: sub.paidTrial ? trialStarts : '',
    payment_frequency: fmtBillingCycle(cycle),
    contract_term: contractTermLabel(cycle),
  }
}

/** Shared inline styles for inserted subscription quote tables. */
export const TEMPLATE_TABLE = {
  border: '#e5e7eb',
  headerBg: '#f3f4f6',
  fontSize: '11px',
  cellPad: '3px 6px',
} as const

/** HTML table snippet operators can paste / seed for subscription comparison. */
export function subscriptionQuoteTableHtml(): string {
  const cell = `padding:${TEMPLATE_TABLE.cellPad};border:1px solid ${TEMPLATE_TABLE.border};line-height:1.25;font-size:${TEMPLATE_TABLE.fontSize};vertical-align:middle`
  const row = (label: string, key: string) =>
    `<tr><td style="${cell}">${label}</td><td style="${cell};text-align:right">{{${key}}}</td></tr>`

  const body = SUBSCRIPTION_TEMPLATE_VARIABLES.map(v =>
    row(v.label, v.key)
  ).join('')

  return [
    `<table style="width:100%;border-collapse:collapse;margin:6px 0;font-size:${TEMPLATE_TABLE.fontSize}">`,
    `<thead><tr style="background:${TEMPLATE_TABLE.headerBg}">`,
    `<th style="${cell};text-align:left;font-weight:600">Item</th>`,
    `<th style="${cell};text-align:right;font-weight:600">Quoted</th>`,
    '</tr></thead><tbody>',
    body,
    '</tbody></table>',
  ].join('')
}
