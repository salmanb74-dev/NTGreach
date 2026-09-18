export type RestoAdminEnv = 'staging' | 'production'

export type RestoTenant = {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  /** Nest plan_id: free / starter / pro / enterprise */
  planId: string | null
  /** Nest subscription status (active / trial / …) */
  planStatus: string | null
  enterpriseInPaidTrial: boolean | null
  /** YYYY-MM-DD subscription start; null on free / unavailable */
  subscriptionStart: string | null
  /** YYYY-MM-DD; persists after trial ends if they ever had one */
  trialStartedAt: string | null
  /** Nest: 1_month | 3_month | 6_month | 1_year | 2_year (blank UI on Free/Trial) */
  billingCycle: string | null
  locationsUsed: number | null
  locationsLimit: number | null
  countersUsed: number | null
  countersLimit: number | null
  usersUsed: number | null
  usersLimit: number | null
  /** Orders in current subscription-period month vs monthly cap */
  ordersUsed: number | null
  ordersLimit: number | null
  /** YYYY-MM-DD or ISO; null if never ordered */
  lastOrderAt: string | null
}

/** Short plan buckets for Ops tenants list filters. */
export type RestoPlanFilter = 'all' | 'free' | 'trial' | 'pro' | 'ent'

function planBaseId(
  tenant: Pick<RestoTenant, 'planId'>
): string {
  return (tenant.planId || 'free').toLowerCase().split('_')[0] || 'free'
}

export function restoPlanBucket(
  tenant: Pick<
    RestoTenant,
    'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): Exclude<RestoPlanFilter, 'all'> {
  const status = (tenant.planStatus || '').toLowerCase()
  if (
    tenant.enterpriseInPaidTrial === true ||
    status === 'trial' ||
    status === 'trialing'
  ) {
    return 'trial'
  }
  const base = planBaseId(tenant)
  if (base === 'enterprise') return 'ent'
  if (base === 'pro' || base === 'starter') return 'pro'
  return 'free'
}

/** Ops list labels: Ent/Sub · Ent/Trial · Pro · Starter · Free */
export function restoPlanLabel(
  tenant: Pick<
    RestoTenant,
    'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): string {
  const bucket = restoPlanBucket(tenant)
  const base = planBaseId(tenant)
  if (bucket === 'trial') {
    return base === 'enterprise' || tenant.enterpriseInPaidTrial === true
      ? 'Ent/Trial'
      : 'Trial'
  }
  if (bucket === 'ent') return 'Ent/Sub'
  if (base === 'starter') return 'Starter'
  if (base === 'pro') return 'Pro'
  return 'Free'
}

/** Blank on Free / Trial; otherwise compact cycle label. */
export function restoBillingCycleLabel(
  tenant: Pick<
    RestoTenant,
    'billingCycle' | 'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): string | null {
  const bucket = restoPlanBucket(tenant)
  if (bucket === 'free' || bucket === 'trial') return null

  const raw = (tenant.billingCycle || '').trim().toLowerCase()
  if (!raw) return null

  const normalized = raw.replace(/-/g, '_')
  const map: Record<string, string> = {
    '1_month': '1 mo',
    monthly: '1 mo',
    month: '1 mo',
    '3_month': '3 mo',
    '6_month': '6 mo',
    '1_year': '1 yr',
    yearly: '1 yr',
    annual: '1 yr',
    year: '1 yr',
    '2_year': '2 yr',
  }
  return map[normalized] ?? tenant.billingCycle
}

function formatUsagePart(
  used: number | null,
  limit: number | null
): string {
  const usedLabel = used == null ? '—' : String(used)
  const limitLabel = limit == null ? '∞' : String(limit)
  return `${usedLabel}/${limitLabel}`
}

/**
 * Compact usage: `L 2/5 · C 1/3 · U 4/10 · O 120/500`
 * (Locations, Counters, Users, Orders/month). Null when Nest sends nothing.
 */
export function restoUsageLabel(
  tenant: Pick<
    RestoTenant,
    | 'locationsUsed'
    | 'locationsLimit'
    | 'countersUsed'
    | 'countersLimit'
    | 'usersUsed'
    | 'usersLimit'
    | 'ordersUsed'
    | 'ordersLimit'
  >
): string | null {
  const values = [
    tenant.locationsUsed,
    tenant.locationsLimit,
    tenant.countersUsed,
    tenant.countersLimit,
    tenant.usersUsed,
    tenant.usersLimit,
    tenant.ordersUsed,
    tenant.ordersLimit,
  ]
  if (values.every(v => v == null)) return null

  return [
    `L ${formatUsagePart(tenant.locationsUsed, tenant.locationsLimit)}`,
    `C ${formatUsagePart(tenant.countersUsed, tenant.countersLimit)}`,
    `U ${formatUsagePart(tenant.usersUsed, tenant.usersLimit)}`,
    `O ${formatUsagePart(tenant.ordersUsed, tenant.ordersLimit)}`,
  ].join(' · ')
}

/** One HTTP request row from Nest `api_hits` (admin logs API). */
export type RestoApiHit = {
  id: string
  tenantId: string | null
  tenantName: string | null
  branchId: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  /** e.g. "GET /api/v1/orders" */
  actionType: string
  metadata: RestoApiHitMetadata
  createdAt: string
}

/** Known keys on api_hits metadata; extra keys allowed. */
export type RestoApiHitMetadata = {
  method?: string
  url?: string
  statusCode?: number
  responseTimeMs?: number
  requestBody?: unknown
  responseBody?: unknown
  [key: string]: unknown
}

/** @deprecated Prefer RestoApiHit — same shape for Reach consumers. */
export type RestoAuditLog = RestoApiHit

export type RestoLogsQuery = {
  tenantId?: string
  /** Method or URL substring match (Nest-side). */
  actionType?: string
  method?: string
  statusCode?: number | string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export type RestoLogsPage = {
  logs: RestoApiHit[]
  nextCursor: string | null
}

/** Nest DELETE /api/v1/admin/tenants/:id summary fields (flexible). */
export type RestoTenantDeleteSummary = {
  tenantId: string | null
  tenantName: string | null
  tenantEmail: string | null
  usersDeleted: number | null
  authUsersDeleted: number | null
  authUsersFailed: number | null
  ordersDeleted: number | null
  branchesDeleted: number | null
  apiHitsDeleted: number | null
  warnings: string[]
  steps: string[]
}

export type RestoTenantDeleteResult = {
  deleted: boolean
  tenantId: string
  tenantName: string | null
  summary: RestoTenantDeleteSummary | null
}

/** PUT /subscription/enterprise — every key required (null where allowed). */
export type RestoEnterpriseOfferInput = {
  price: number
  durationMonths: number
  setupFee: number
  locations: number | null
  users: number | null
  counters: number | null
  ordersPerMonth: number | null
  callCenter: boolean | null
  kds: boolean | null
  inventory: boolean | null
  support: boolean | null
  webOrdering: boolean | null
  paidTrial: boolean
  paidTrialDays: number | null
  preTrialSetupFee: number | null
  postTrialSetupFee: number | null
  accessStartsAt: string | null
  enterpriseEnabled: boolean
}

export const ENTERPRISE_OFFER_KEYS: ReadonlyArray<keyof RestoEnterpriseOfferInput> = [
  'price',
  'durationMonths',
  'setupFee',
  'locations',
  'users',
  'counters',
  'ordersPerMonth',
  'callCenter',
  'kds',
  'inventory',
  'support',
  'webOrdering',
  'paidTrial',
  'paidTrialDays',
  'preTrialSetupFee',
  'postTrialSetupFee',
  'accessStartsAt',
  'enterpriseEnabled',
]

export type RestoSubscriptionSnapshot = {
  id: string | null
  tenantId: string | null
  planId: string | null
  billingCycle: string | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelledAt: string | null
  enterpriseEnabled: boolean | null
  enterprisePrice: number | null
  enterpriseDurationMonths: number | null
  enterpriseSetupFee: number | null
  enterpriseLocationsLimit: number | null
  enterpriseUsersLimit: number | null
  enterpriseCountersLimit: number | null
  enterpriseOrdersMonthLimit: number | null
  enterpriseCallcenterEnabled: boolean | null
  enterpriseKdsEnabled: boolean | null
  enterpriseInventoryEnabled: boolean | null
  addonSupportEnabled: boolean | null
  addonWebOrderingEnabled: boolean | null
  enterprisePaidTrialEnabled: boolean | null
  enterprisePaidTrialDurationDays: number | null
  enterprisePreTrialSetupFee: number | null
  enterprisePostTrialSetupFee: number | null
  enterpriseAccessStartsAt: string | null
  currentEnterprisePrice: number | null
  currentEnterpriseDurationMonths: number | null
  currentEnterpriseLocationsLimit: number | null
  currentEnterpriseUsersLimit: number | null
  currentEnterpriseCountersLimit: number | null
  currentEnterpriseOrdersMonthLimit: number | null
  currentEnterpriseCallcenterEnabled: boolean | null
  currentEnterpriseKdsEnabled: boolean | null
  currentEnterpriseInventoryEnabled: boolean | null
  currentEnterpriseSupportEnabled: boolean | null
  currentEnterpriseWebOrderingEnabled: boolean | null
  /**
   * Lifetime setup fees paid to date (USD): regular + pre + post collected.
   * Nest: setupFeePaidUsd / setup_fee_paid_usd. Read-only — never on PUT.
   */
  setupFeePaidUsd: number | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  created: boolean
  usageCreated: boolean
  warnings: string[]
}

export type RestoSubscriptionTenant = {
  id: string
  name: string | null
  email: string | null
  subdomain: string | null
}

export type RestoSubscriptionGetResult = {
  tenant: RestoSubscriptionTenant | null
  subscription: RestoSubscriptionSnapshot | null
  notes: string[]
}

export type RestoEnterprisePutResult = {
  upserted: boolean
  created: boolean
  tenant: RestoSubscriptionTenant | null
  subscription: RestoSubscriptionSnapshot | null
  notes: string[]
}

export type RestoEnterpriseClearResult = {
  cleared: boolean
  tenant: RestoSubscriptionTenant | null
  subscription: RestoSubscriptionSnapshot | null
  notes: string[]
}

export type RestoAdminTenantTab =
  | 'overview'
  | 'reports'
  | 'subscription'
  | 'cash'
  | 'delete'
  | 'logs'

const TENANT_TABS: ReadonlySet<RestoAdminTenantTab> = new Set([
  'overview',
  'reports',
  'subscription',
  'cash',
  'delete',
  'logs',
])

export function isRestoAdminTenantTab(
  value: string | null | undefined
): value is RestoAdminTenantTab {
  return typeof value === 'string' && TENANT_TABS.has(value as RestoAdminTenantTab)
}

export function parseTenantTab(
  value: string | null | undefined
): RestoAdminTenantTab {
  return isRestoAdminTenantTab(value) ? value : 'overview'
}

export function isRestoAdminEnv(value: string | null | undefined): value is RestoAdminEnv {
  return value === 'staging' || value === 'production'
}

export function parseRestoAdminEnv(
  value: string | null | undefined,
  fallback: RestoAdminEnv = 'staging'
): RestoAdminEnv {
  return isRestoAdminEnv(value) ? value : fallback
}

export function metaString(
  meta: RestoApiHitMetadata,
  key: string
): string | null {
  const v = meta[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

export function metaNumber(
  meta: RestoApiHitMetadata,
  key: string
): number | null {
  const v = meta[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}
