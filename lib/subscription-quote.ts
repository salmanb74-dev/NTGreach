/**
 * Shared Resto Enterprise-style quote parameters for CRM:
 * lead Deal Values → contract/quotation {{variables}}.
 * Aligned with ops TenantSubscriptionPanel / Nest enterprise offer.
 */

export type QuotedLimit = number | null // null + unlimited flag → Unlimited

export type BillingCycle = 'monthly' | 'annual'

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
  monthlyPrice: 35,
  billingCycle: 'monthly',
  durationMonths: 1,
  setupFee: 350,
  locations: 1,
  locationsUnlimited: false,
  users: 50,
  usersUnlimited: false,
  counters: 2,
  countersUnlimited: false,
  ordersPerMonth: 3000,
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
  if (sub.callCenter) total += sub.callCenterFee ?? 0
  if (sub.kds) total += sub.kdsFee ?? 0
  if (sub.inventory) total += sub.inventoryFee ?? 0
  if (sub.support) total += sub.supportFee ?? 0
  if (sub.webOrdering) total += sub.webOrderingFee ?? 0
  return total
}

/** Base platform fee + enabled addon monthly fees. */
export function totalMonthlyRecurring(sub: QuotedSubscription): number {
  return (sub.monthlyPrice ?? 0) + addonMonthlyFees(sub)
}

export type DealQuoteDefaults = {
  currency: string
  billingCycle: BillingCycle
  subscription: QuotedSubscription
}

export const STARTER_DEAL_QUOTE_DEFAULTS: DealQuoteDefaults = {
  currency: 'USD',
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
  const subscription = {
    ...d.subscription,
    billingCycle: d.billingCycle,
    durationMonths: monthsForBillingCycle(d.billingCycle),
  }
  return {
    deal_currency: d.currency,
    quoted_mrr: totalMonthlyRecurring(subscription),
    quoted_setup_fee: d.subscription.setupFee,
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

/** Template {{key}} definitions for subscription rows (contracts + quotations). */
export const SUBSCRIPTION_TEMPLATE_VARIABLES = [
  { key: 'platform_fee', label: 'Platform fee (base)', example: '35' },
  { key: 'platform_fee_total', label: 'Platform fee total / mo', example: '55' },
  { key: 'billing_cycle', label: 'Billing cycle', example: 'Monthly' },
  { key: 'setup_fee', label: 'Setup fee', example: '700' },
  { key: 'pre_trial_setup_fee', label: 'Pre-trial setup', example: '0' },
  { key: 'post_trial_setup_fee', label: 'Post-trial setup', example: '350' },
  { key: 'branches', label: 'Branches', example: '3' },
  { key: 'users', label: 'Users', example: '10' },
  { key: 'counters', label: 'Counters', example: '5' },
  { key: 'orders_per_month', label: 'Orders / month', example: 'Unlimited' },
  { key: 'call_center', label: 'Call center / mo', example: '15' },
  { key: 'kds', label: 'Kitchen display / mo', example: '10' },
  { key: 'inventory', label: 'Inventory / mo', example: 'No' },
  { key: 'ops_support', label: 'Ops support / mo', example: '25' },
  { key: 'web_ordering', label: 'Web ordering / mo', example: '20' },
  {
    key: 'web_ordering_revenue_pct',
    label: 'Web ordering revenue %',
    example: '2.5',
  },
  { key: 'paid_trial', label: 'Paid trial', example: 'Yes' },
  { key: 'paid_trial_days', label: 'Trial days', example: '14' },
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_QUOTED_SUBSCRIPTION }
  }
  const r = raw as Record<string, unknown>
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

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
}

function fmtLimit(
  value: number | null | undefined,
  unlimited: boolean
): string {
  if (unlimited) return 'Unlimited'
  if (value == null) return ''
  return String(value)
}

function fmtYesNo(v: boolean): string {
  return v ? 'Yes' : 'No'
}

/** Enabled feature → monthly $ string; otherwise "No". */
function fmtAddonFee(
  enabled: boolean,
  fee: number | null | undefined
): string {
  if (!enabled) return 'No'
  return fmtMoney(fee ?? 0)
}

function fmtPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n)
}

function formatAccessDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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

/** Merge lead row + quoted_subscription into template variable strings. */
export function subscriptionVarsFromLead(
  lead: LeadQuoteSource,
  inputCurrency: string
): Record<string, string> {
  const sub = parseQuotedSubscription({
    ...(typeof lead.quoted_subscription === 'object' &&
    lead.quoted_subscription &&
    !Array.isArray(lead.quoted_subscription)
      ? (lead.quoted_subscription as Record<string, unknown>)
      : {}),
    paymentFrequency: lead.payment_frequency,
  })
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
  const platformFee = fmtMoney(baseMonthly)
  const platformFeeTotal = fmtMoney(totalMonthly)

  return {
    currency: lead.deal_currency ?? inputCurrency,
    platform_fee: platformFee,
    platform_fee_total: platformFeeTotal,
    billing_cycle: fmtBillingCycle(cycle),
    setup_fee: fmtMoney(setupDisplay ?? setup),
    pre_trial_setup_fee: fmtMoney(preSetup),
    post_trial_setup_fee: fmtMoney(postSetup),
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
    paid_trial: fmtYesNo(sub.paidTrial),
    paid_trial_days:
      sub.paidTrial && sub.paidTrialDays != null
        ? String(sub.paidTrialDays)
        : '',
    trial_starts: trialStarts,
    // aliases for older templates
    monthly_price: platformFeeTotal || platformFee,
    recurring_fee: platformFeeTotal || platformFee,
    duration_months: String(months),
    term_total: fmtMoney(total),
    locations: branches,
    support: opsSupport,
    access_starts: trialStarts,
    payment_frequency: cycle === 'annual' ? 'Annual' : 'Monthly',
    contract_term: cycle === 'annual' ? '12 months' : '1 month',
  }
}

/** HTML table snippet operators can paste / seed for subscription comparison. */
export function subscriptionQuoteTableHtml(): string {
  const row = (label: string, key: string) =>
    `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">${label}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{${key}}}</td></tr>`

  return [
    '<table style="width:100%;border-collapse:collapse">',
    '<thead><tr style="background:#f3f4f6">',
    '<th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Item</th>',
    '<th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">Quoted</th>',
    '</tr></thead><tbody>',
    row('Platform fee (base / mo)', 'platform_fee'),
    row('Platform fee total / mo', 'platform_fee_total'),
    row('Billing cycle', 'billing_cycle'),
    row('Setup fee', 'setup_fee'),
    row('Pre-trial setup', 'pre_trial_setup_fee'),
    row('Post-trial setup', 'post_trial_setup_fee'),
    row('Branches', 'branches'),
    row('Users', 'users'),
    row('Counters', 'counters'),
    row('Orders / month', 'orders_per_month'),
    row('Call center / mo', 'call_center'),
    row('Kitchen display / mo', 'kds'),
    row('Inventory / mo', 'inventory'),
    row('Ops support / mo', 'ops_support'),
    row('Web ordering / mo', 'web_ordering'),
    row('Web ordering revenue %', 'web_ordering_revenue_pct'),
    row('Paid trial', 'paid_trial'),
    row('Trial days', 'paid_trial_days'),
    row('Trial starts', 'trial_starts'),
    '</tbody></table>',
  ].join('')
}
