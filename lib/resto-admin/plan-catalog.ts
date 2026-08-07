/**
 * Catalog mirror of Nest PLAN_CONFIGS (plan-config.ts) for free/starter/pro.
 * Enterprise active terms come from subscription.current_enterprise_* .
 * Keep in sync when Nest catalog changes.
 */

export type LimitValue = number | 'unlimited'

export type RestoPlanCatalogEntry = {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  setupFee: number
  locations: LimitValue
  users: LimitValue
  counters: LimitValue
  ordersMonth: LimitValue
  menuItems: LimitValue
  hasCallCenter: boolean
  hasKitchenDisplay: boolean
  hasInventory: boolean
  hasReports: boolean
}

const YEARLY_DISCOUNT = 0.1

function annualFromMonthly(monthly: number): number {
  if (monthly <= 0) return 0
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT))
}

export const RESTO_PLAN_CATALOG: Record<string, RestoPlanCatalogEntry> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    setupFee: 0,
    locations: 1,
    users: 2,
    counters: 1,
    ordersMonth: 50,
    menuItems: 'unlimited',
    hasCallCenter: false,
    hasKitchenDisplay: false,
    hasInventory: false,
    hasReports: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 35,
    priceYearly: annualFromMonthly(35),
    setupFee: 350,
    locations: 1,
    users: 50,
    counters: 2,
    ordersMonth: 3000,
    menuItems: 'unlimited',
    hasCallCenter: false,
    hasKitchenDisplay: false,
    hasInventory: false,
    hasReports: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 70,
    priceYearly: annualFromMonthly(70),
    setupFee: 700,
    locations: 3,
    users: 50,
    counters: 6,
    ordersMonth: 15000,
    menuItems: 'unlimited',
    hasCallCenter: true,
    hasKitchenDisplay: true,
    hasInventory: true,
    hasReports: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    setupFee: 0,
    locations: 'unlimited',
    users: 'unlimited',
    counters: 'unlimited',
    ordersMonth: 'unlimited',
    menuItems: 'unlimited',
    hasCallCenter: true,
    hasKitchenDisplay: true,
    hasInventory: true,
    hasReports: true,
  },
}

export function normalizePlanBaseId(planId: string | null | undefined): string {
  if (!planId) return 'free'
  return planId.toLowerCase().split('_')[0] || 'free'
}

export function getPlanCatalogEntry(
  planId: string | null | undefined
): RestoPlanCatalogEntry {
  const base = normalizePlanBaseId(planId)
  return RESTO_PLAN_CATALOG[base] ?? RESTO_PLAN_CATALOG.free
}

export type ActivePlanView = {
  planId: string
  planName: string
  source: 'catalog' | 'enterprise_live' | 'enterprise_catalog'
  billingCycle: string | null
  status: string | null
  termPrice: number | null
  monthlyPrice: number | null
  durationMonths: number | null
  setupFee: number | null
  locations: LimitValue
  users: LimitValue
  counters: LimitValue
  ordersMonth: LimitValue
  menuItems: LimitValue
  callCenter: boolean
  kds: boolean
  inventory: boolean
  support: boolean
  webOrdering: boolean
  hasReports: boolean
  periodStart: string | null
  periodEnd: string | null
  trialEndsAt: string | null
  cancelledAt: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  paidTrial: boolean
  paidTrialDays: number | null
  accessStartsAt: string | null
}

function limitOrUnlimited(v: number | null | undefined): LimitValue {
  if (v == null) return 'unlimited'
  if (!Number.isFinite(v)) return 'unlimited'
  return v
}

function boolOr(
  v: boolean | null | undefined,
  fallback: boolean
): boolean {
  if (v === true) return true
  if (v === false) return false
  return fallback
}

export type SubLike = {
  planId: string | null
  billingCycle: string | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelledAt: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  addonSupportEnabled: boolean | null
  addonWebOrderingEnabled: boolean | null
  enterprisePaidTrialEnabled?: boolean | null
  enterprisePaidTrialDurationDays?: number | null
  enterpriseAccessStartsAt?: string | null
  currentEnterprisePrice: number | null
  currentEnterpriseDurationMonths: number | null
  currentEnterpriseLocationsLimit?: number | null
  currentEnterpriseUsersLimit?: number | null
  currentEnterpriseCountersLimit?: number | null
  currentEnterpriseOrdersMonthLimit?: number | null
  currentEnterpriseCallcenterEnabled?: boolean | null
  currentEnterpriseKdsEnabled?: boolean | null
  currentEnterpriseInventoryEnabled?: boolean | null
  currentEnterpriseSupportEnabled?: boolean | null
  currentEnterpriseWebOrderingEnabled?: boolean | null
}

/**
 * Resolve the tenant’s *active* plan entitlements for display.
 * Not the editable Enterprise sales offer.
 */
export function resolveActivePlanView(sub: SubLike | null): ActivePlanView | null {
  if (!sub) return null

  const baseId = normalizePlanBaseId(sub.planId)
  const catalog = getPlanCatalogEntry(baseId)
  const isEnterprise = baseId === 'enterprise'
  const hasLiveEnterprise = isEnterprise && sub.currentEnterprisePrice != null

  if (hasLiveEnterprise) {
    const duration = sub.currentEnterpriseDurationMonths
    const term = sub.currentEnterprisePrice
    return {
      planId: sub.planId ?? 'enterprise',
      planName: 'Enterprise (live)',
      source: 'enterprise_live',
      billingCycle: sub.billingCycle,
      status: sub.status,
      termPrice: term,
      monthlyPrice:
        term != null && duration != null && duration > 0 ? term / duration : term,
      durationMonths: duration,
      setupFee: null,
      locations: limitOrUnlimited(sub.currentEnterpriseLocationsLimit),
      users: limitOrUnlimited(sub.currentEnterpriseUsersLimit),
      counters: limitOrUnlimited(sub.currentEnterpriseCountersLimit),
      ordersMonth: limitOrUnlimited(sub.currentEnterpriseOrdersMonthLimit),
      menuItems: 'unlimited',
      callCenter: boolOr(sub.currentEnterpriseCallcenterEnabled, true),
      kds: boolOr(sub.currentEnterpriseKdsEnabled, true),
      inventory: boolOr(sub.currentEnterpriseInventoryEnabled, true),
      support: boolOr(
        sub.currentEnterpriseSupportEnabled,
        sub.addonSupportEnabled === true
      ),
      webOrdering: boolOr(
        sub.currentEnterpriseWebOrderingEnabled,
        sub.addonWebOrderingEnabled === true
      ),
      hasReports: true,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelledAt: sub.cancelledAt,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeCustomerId: sub.stripeCustomerId,
      paidTrial: false,
      paidTrialDays: null,
      accessStartsAt: null,
    }
  }

  const cycle = (sub.billingCycle || 'monthly').toLowerCase()
  const monthly =
    isEnterprise && !hasLiveEnterprise
      ? null
      : cycle === 'yearly'
        ? catalog.priceYearly / 12
        : catalog.priceMonthly

  return {
    planId: sub.planId ?? catalog.id,
    planName: catalog.name,
    source: isEnterprise ? 'enterprise_catalog' : 'catalog',
    billingCycle: sub.billingCycle,
    status: sub.status,
    termPrice:
      isEnterprise
        ? null
        : cycle === 'yearly'
          ? catalog.priceYearly
          : catalog.priceMonthly,
    monthlyPrice: monthly,
    durationMonths: isEnterprise ? null : cycle === 'yearly' ? 12 : 1,
    setupFee: catalog.setupFee,
    locations: catalog.locations,
    users: catalog.users,
    counters: catalog.counters,
    ordersMonth: catalog.ordersMonth,
    menuItems: catalog.menuItems,
    callCenter: catalog.hasCallCenter,
    kds: catalog.hasKitchenDisplay,
    inventory: catalog.hasInventory,
    support: sub.addonSupportEnabled === true,
    webOrdering: sub.addonWebOrderingEnabled === true,
    hasReports: catalog.hasReports,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    cancelledAt: sub.cancelledAt,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId,
    paidTrial: false,
    paidTrialDays: null,
    accessStartsAt: null,
  }
}

function limitToNullable(v: LimitValue): number | null {
  return v === 'unlimited' ? null : v
}

/**
 * Seed an Enterprise offer form from the tenant’s active plan entitlements.
 * Nest requires price > 0 — free plan monthly is clamped to a small positive.
 */
export function activePlanToOfferSeed(
  plan: ActivePlanView,
  defaults: {
    price: number
    durationMonths: number
  }
): {
  monthlyPrice: number
  durationMonths: number
  setupFee: number
  locations: number | null
  users: number | null
  counters: number | null
  ordersPerMonth: number | null
  callCenter: boolean
  kds: boolean
  inventory: boolean
  support: boolean
  webOrdering: boolean
} {
  const durationMonths =
    plan.durationMonths && plan.durationMonths > 0
      ? plan.durationMonths
      : defaults.durationMonths

  let monthly =
    plan.monthlyPrice != null && Number.isFinite(plan.monthlyPrice)
      ? plan.monthlyPrice
      : defaults.price / defaults.durationMonths

  // Offer API requires price > 0
  if (!(monthly > 0)) {
    monthly = defaults.price / defaults.durationMonths
  }

  return {
    monthlyPrice: monthly,
    durationMonths,
    setupFee: plan.setupFee != null && plan.setupFee >= 0 ? plan.setupFee : 0,
    locations: limitToNullable(plan.locations),
    users: limitToNullable(plan.users),
    counters: limitToNullable(plan.counters),
    ordersPerMonth: limitToNullable(plan.ordersMonth),
    callCenter: plan.callCenter,
    kds: plan.kds,
    inventory: plan.inventory,
    support: plan.support,
    webOrdering: plan.webOrdering,
  }
}
