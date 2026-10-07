/**
 * Catalog mirror of Nest PLAN_CONFIGS for Alma free/starter/pro.
 * Enterprise active terms come from subscription.current_enterprise_* .
 */

export type LimitValue = number | 'unlimited'

export type AlmaPlanCatalogEntry = {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  setupFee: number
  branches: LimitValue
  students: LimitValue
  storageGb: LimitValue
}

const YEARLY_DISCOUNT = 0.1

function annualFromMonthly(monthly: number): number {
  if (monthly <= 0) return 0
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT))
}

export const ALMA_PLAN_CATALOG: Record<string, AlmaPlanCatalogEntry> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    setupFee: 0,
    branches: 1,
    students: 200,
    storageGb: 10,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 35,
    priceYearly: annualFromMonthly(35),
    setupFee: 350,
    branches: 1,
    students: 200,
    storageGb: 10,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 70,
    priceYearly: annualFromMonthly(70),
    setupFee: 700,
    branches: 3,
    students: 500,
    storageGb: 25,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    setupFee: 0,
    branches: 'unlimited',
    students: 'unlimited',
    storageGb: 'unlimited',
  },
}

export function normalizePlanBaseId(planId: string | null | undefined): string {
  if (!planId) return 'free'
  return planId.toLowerCase().split('_')[0] || 'free'
}

export function getPlanCatalogEntry(
  planId: string | null | undefined
): AlmaPlanCatalogEntry {
  const base = normalizePlanBaseId(planId)
  return ALMA_PLAN_CATALOG[base] ?? ALMA_PLAN_CATALOG.free
}

export type AlmaActivePlanView = {
  planId: string
  planName: string
  source: 'catalog' | 'enterprise_live' | 'enterprise_catalog'
  billingCycle: string | null
  status: string | null
  termPrice: number | null
  monthlyPrice: number | null
  durationMonths: number | null
  setupFee: number | null
  branches: LimitValue
  students: LimitValue
  storageGb: LimitValue
  fees: boolean
  library: boolean
  behavioural: boolean
  uniformInventory: boolean
  whiteLabel: boolean
  googleClassroom: boolean
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

function boolOr(v: boolean | null | undefined, fallback: boolean): boolean {
  if (v === true) return true
  if (v === false) return false
  return fallback
}

export type AlmaSubLike = {
  planId: string | null
  billingCycle: string | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelledAt: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  enterprisePaidTrialEnabled?: boolean | null
  enterprisePaidTrialDurationDays?: number | null
  enterpriseInPaidTrial?: boolean | null
  enterpriseAccessStartsAt?: string | null
  enterprisePrice?: number | null
  enterpriseDurationMonths?: number | null
  enterpriseSetupFee?: number | null
  currentEnterprisePrice: number | null
  currentEnterpriseDurationMonths: number | null
  currentEnterpriseBranchesLimit?: number | null
  currentEnterpriseStudentsLimit?: number | null
  currentEnterpriseStorageGbLimit?: number | null
  currentEnterpriseFeesEnabled?: boolean | null
  currentEnterpriseLibraryEnabled?: boolean | null
  currentEnterpriseBehaviouralEnabled?: boolean | null
  currentEnterpriseUniformInventoryEnabled?: boolean | null
  currentEnterpriseWhiteLabelEnabled?: boolean | null
  currentEnterpriseGoogleClassroomEnabled?: boolean | null
}

function isPaidTrialActive(sub: AlmaSubLike): boolean {
  if (sub.enterpriseInPaidTrial === true) return true
  const base = normalizePlanBaseId(sub.planId)
  const status = (sub.status || '').toLowerCase()
  return (
    base === 'enterprise' &&
    (status === 'trial' || status === 'trialing')
  )
}

function liveAddonFlags(sub: AlmaSubLike): {
  fees: boolean
  library: boolean
  behavioural: boolean
  uniformInventory: boolean
  whiteLabel: boolean
  googleClassroom: boolean
} {
  return {
    fees: boolOr(sub.currentEnterpriseFeesEnabled, false),
    library: boolOr(sub.currentEnterpriseLibraryEnabled, false),
    behavioural: boolOr(sub.currentEnterpriseBehaviouralEnabled, false),
    uniformInventory: boolOr(sub.currentEnterpriseUniformInventoryEnabled, false),
    whiteLabel: boolOr(sub.currentEnterpriseWhiteLabelEnabled, false),
    googleClassroom: boolOr(sub.currentEnterpriseGoogleClassroomEnabled, false),
  }
}

export function resolveActivePlanView(
  sub: AlmaSubLike | null
): AlmaActivePlanView | null {
  if (!sub) return null

  const baseId = normalizePlanBaseId(sub.planId)
  const catalog = getPlanCatalogEntry(baseId)
  const isEnterprise = baseId === 'enterprise'
  const hasLiveEnterprise = isEnterprise && sub.currentEnterprisePrice != null
  const onPaidTrial = isPaidTrialActive(sub)
  const hasCurrentSnapshot =
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

  if (hasLiveEnterprise || (onPaidTrial && hasCurrentSnapshot)) {
    const duration = sub.currentEnterpriseDurationMonths
    const term = sub.currentEnterprisePrice
    const addons = liveAddonFlags(sub)

    if (onPaidTrial) {
      return {
        planId: sub.planId ?? 'enterprise',
        planName: 'Enterprise (trial)',
        source: 'enterprise_live',
        billingCycle: sub.billingCycle,
        status: sub.status,
        termPrice: null,
        monthlyPrice: null,
        durationMonths: null,
        setupFee: null,
        branches: limitOrUnlimited(sub.currentEnterpriseBranchesLimit),
        students: limitOrUnlimited(sub.currentEnterpriseStudentsLimit),
        storageGb: limitOrUnlimited(sub.currentEnterpriseStorageGbLimit),
        ...addons,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
        cancelledAt: sub.cancelledAt,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeCustomerId: sub.stripeCustomerId,
        paidTrial: true,
        paidTrialDays: null,
        accessStartsAt: null,
      }
    }

    return {
      planId: sub.planId ?? 'enterprise',
      planName: 'Enterprise (live)',
      source: 'enterprise_live',
      billingCycle: sub.billingCycle,
      status: sub.status,
      termPrice: term ?? null,
      monthlyPrice:
        term != null && duration != null && duration > 0 ? term / duration : term,
      durationMonths: duration ?? null,
      setupFee: null,
      branches: limitOrUnlimited(sub.currentEnterpriseBranchesLimit),
      students: limitOrUnlimited(sub.currentEnterpriseStudentsLimit),
      storageGb: limitOrUnlimited(sub.currentEnterpriseStorageGbLimit),
      ...addons,
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

  if (onPaidTrial) {
    return {
      planId: sub.planId ?? 'enterprise',
      planName: 'Enterprise (trial)',
      source: 'enterprise_live',
      billingCycle: sub.billingCycle,
      status: sub.status,
      termPrice: null,
      monthlyPrice: null,
      durationMonths: null,
      setupFee: null,
      branches: 'unlimited',
      students: 'unlimited',
      storageGb: 'unlimited',
      fees: false,
      library: false,
      behavioural: false,
      uniformInventory: false,
      whiteLabel: false,
      googleClassroom: false,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelledAt: sub.cancelledAt,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeCustomerId: sub.stripeCustomerId,
      paidTrial: true,
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
    termPrice: isEnterprise
      ? null
      : cycle === 'yearly'
        ? catalog.priceYearly
        : catalog.priceMonthly,
    monthlyPrice: monthly,
    durationMonths: isEnterprise ? null : cycle === 'yearly' ? 12 : 1,
    setupFee: catalog.setupFee,
    branches: catalog.branches,
    students: catalog.students,
    storageGb: catalog.storageGb,
    fees: false,
    library: false,
    behavioural: false,
    uniformInventory: false,
    whiteLabel: false,
    googleClassroom: false,
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

export function activePlanToOfferSeed(
  plan: AlmaActivePlanView,
  defaults: {
    price: number
    durationMonths: number
  }
): {
  monthlyPrice: number
  durationMonths: number
  setupFee: number
  branches: number | null
  students: number | null
  storageGb: number | null
  fees: boolean
  library: boolean
  behavioural: boolean
  uniformInventory: boolean
  whiteLabel: boolean
  googleClassroom: boolean
} {
  const durationMonths =
    plan.durationMonths && plan.durationMonths > 0
      ? plan.durationMonths
      : defaults.durationMonths

  let monthly =
    plan.monthlyPrice != null && Number.isFinite(plan.monthlyPrice)
      ? plan.monthlyPrice
      : defaults.price / defaults.durationMonths

  if (!(monthly > 0)) {
    monthly = defaults.price / defaults.durationMonths
  }

  return {
    monthlyPrice: monthly,
    durationMonths,
    setupFee: plan.setupFee != null && plan.setupFee >= 0 ? plan.setupFee : 0,
    branches: limitToNullable(plan.branches),
    students: limitToNullable(plan.students),
    storageGb: limitToNullable(plan.storageGb),
    fees: plan.fees,
    library: plan.library,
    behavioural: plan.behavioural,
    uniformInventory: plan.uniformInventory,
    whiteLabel: plan.whiteLabel,
    googleClassroom: plan.googleClassroom,
  }
}
