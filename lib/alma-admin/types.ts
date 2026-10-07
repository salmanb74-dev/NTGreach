export type AlmaAdminEnv = 'staging' | 'production'

export type AlmaTenant = {
  id: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  planId: string | null
  planStatus: string | null
  enterpriseInPaidTrial: boolean | null
  subscriptionStart: string | null
  firstSubscriptionStartDate: string | null
  trialStartedAt: string | null
  billingCycle: string | null
  branchesUsed: number | null
  branchesLimit: number | null
  studentsUsed: number | null
  studentsLimit: number | null
  storageGbUsed: number | null
  storageGbLimit: number | null
  /** Nest indefinite assessments-creation lock (ops). Missing → false. */
  assessmentsCreationLocked: boolean
}

/** GET/PUT /api/v1/admin/tenants/:id/assessments-lock */
export type AlmaAssessmentsLockStatus = {
  tenantId: string
  tenantName: string | null
  subdomain: string | null
  locked: boolean
  lockedAt: string | null
  reason: string | null
}

export type AlmaAssessmentsLockPutResult = AlmaAssessmentsLockStatus & {
  changed: boolean
}

export type AlmaPlanFilter = 'all' | 'free' | 'trial' | 'pro' | 'ent'

function planBaseId(tenant: Pick<AlmaTenant, 'planId'>): string {
  return (tenant.planId || 'free').toLowerCase().split('_')[0] || 'free'
}

export function almaPlanBucket(
  tenant: Pick<
    AlmaTenant,
    'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): Exclude<AlmaPlanFilter, 'all'> {
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

export function almaPlanLabel(
  tenant: Pick<
    AlmaTenant,
    'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): string {
  const bucket = almaPlanBucket(tenant)
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

export function almaBillingCycleLabel(
  tenant: Pick<
    AlmaTenant,
    'billingCycle' | 'planId' | 'planStatus' | 'enterpriseInPaidTrial'
  >
): string | null {
  const bucket = almaPlanBucket(tenant)
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

function formatUsagePart(used: number | null, limit: number | null): string {
  const usedLabel = used == null ? '—' : String(used)
  const limitLabel = limit == null ? '∞' : String(limit)
  return `${usedLabel}/${limitLabel}`
}

/** Compact usage: `B x/y · S x/y · G x/y` (Branches, Students, Storage GB). */
export function almaUsageLabel(
  tenant: Pick<
    AlmaTenant,
    | 'branchesUsed'
    | 'branchesLimit'
    | 'studentsUsed'
    | 'studentsLimit'
    | 'storageGbUsed'
    | 'storageGbLimit'
  >
): string | null {
  const values = [
    tenant.branchesUsed,
    tenant.branchesLimit,
    tenant.studentsUsed,
    tenant.studentsLimit,
    tenant.storageGbUsed,
    tenant.storageGbLimit,
  ]
  if (values.every(v => v == null)) return null

  return [
    `B ${formatUsagePart(tenant.branchesUsed, tenant.branchesLimit)}`,
    `S ${formatUsagePart(tenant.studentsUsed, tenant.studentsLimit)}`,
    `G ${formatUsagePart(tenant.storageGbUsed, tenant.storageGbLimit)}`,
  ].join(' · ')
}

export type AlmaApiHit = {
  id: string
  tenantId: string | null
  tenantName: string | null
  branchId: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  actionType: string
  metadata: AlmaApiHitMetadata
  createdAt: string
}

export type AlmaApiHitMetadata = {
  method?: string
  url?: string
  statusCode?: number
  responseTimeMs?: number
  requestBody?: unknown
  responseBody?: unknown
  [key: string]: unknown
}

export type AlmaLogsQuery = {
  tenantId?: string
  actionType?: string
  method?: string
  statusCode?: number | string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export type AlmaLogsPage = {
  logs: AlmaApiHit[]
  nextCursor: string | null
}

export type AlmaTenantDeleteSummary = {
  tenantId: string | null
  tenantName: string | null
  tenantEmail: string | null
  usersDeleted: number | null
  authUsersDeleted: number | null
  authUsersFailed: number | null
  studentsDeleted: number | null
  branchesDeleted: number | null
  apiHitsDeleted: number | null
  warnings: string[]
  steps: string[]
}

export type AlmaTenantDeleteResult = {
  deleted: boolean
  tenantId: string
  tenantName: string | null
  summary: AlmaTenantDeleteSummary | null
  confirmedAbsent?: boolean
}

/** PUT /subscription/enterprise — every key required (null where allowed). */
export type AlmaEnterpriseOfferInput = {
  price: number
  durationMonths: number
  setupFee: number
  branches: number | null
  students: number | null
  storageGb: number | null
  fees: boolean | null
  library: boolean | null
  behavioural: boolean | null
  uniformInventory: boolean | null
  whiteLabel: boolean | null
  googleClassroom: boolean | null
  feesMonthly: number | null
  libraryMonthly: number | null
  behaviouralMonthly: number | null
  uniformInventoryMonthly: number | null
  whiteLabelMonthly: number | null
  googleClassroomMonthly: number | null
  paidTrial: boolean
  paidTrialDays: number | null
  preTrialSetupFee: number | null
  postTrialSetupFee: number | null
  accessStartsAt: string | null
  trialStartsAt: string | null
  prorateBackdatedAccess: boolean | null
  enterpriseEnabled: boolean
}

export const ENTERPRISE_OFFER_KEYS: ReadonlyArray<
  keyof AlmaEnterpriseOfferInput
> = [
  'price',
  'durationMonths',
  'setupFee',
  'branches',
  'students',
  'storageGb',
  'fees',
  'library',
  'behavioural',
  'uniformInventory',
  'whiteLabel',
  'googleClassroom',
  'feesMonthly',
  'libraryMonthly',
  'behaviouralMonthly',
  'uniformInventoryMonthly',
  'whiteLabelMonthly',
  'googleClassroomMonthly',
  'paidTrial',
  'paidTrialDays',
  'preTrialSetupFee',
  'postTrialSetupFee',
  'accessStartsAt',
  'trialStartsAt',
  'prorateBackdatedAccess',
  'enterpriseEnabled',
]

export type AlmaSubscriptionSnapshot = {
  id: string | null
  tenantId: string | null
  planId: string | null
  billingCycle: string | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  trialStartedAt: string | null
  cancelledAt: string | null
  enterpriseEnabled: boolean | null
  enterprisePrice: number | null
  enterpriseDurationMonths: number | null
  enterpriseSetupFee: number | null
  enterpriseBranchesLimit: number | null
  enterpriseStudentsLimit: number | null
  enterpriseStorageGbLimit: number | null
  enterpriseFeesEnabled: boolean | null
  enterpriseLibraryEnabled: boolean | null
  enterpriseBehaviouralEnabled: boolean | null
  enterpriseUniformInventoryEnabled: boolean | null
  enterpriseWhiteLabelEnabled: boolean | null
  enterpriseGoogleClassroomEnabled: boolean | null
  enterpriseFeesMonthly: number | null
  enterpriseLibraryMonthly: number | null
  enterpriseBehaviouralMonthly: number | null
  enterpriseUniformInventoryMonthly: number | null
  enterpriseWhiteLabelMonthly: number | null
  enterpriseGoogleClassroomMonthly: number | null
  enterprisePaidTrialEnabled: boolean | null
  enterprisePaidTrialDurationDays: number | null
  enterpriseInPaidTrial: boolean | null
  enterprisePreTrialSetupFee: number | null
  enterprisePostTrialSetupFee: number | null
  enterpriseAccessStartsAt: string | null
  enterpriseTrialStartsAt: string | null
  prorateBackdatedAccess: boolean | null
  currentEnterprisePrice: number | null
  currentEnterpriseDurationMonths: number | null
  currentEnterpriseBranchesLimit: number | null
  currentEnterpriseStudentsLimit: number | null
  currentEnterpriseStorageGbLimit: number | null
  currentEnterpriseFeesEnabled: boolean | null
  currentEnterpriseLibraryEnabled: boolean | null
  currentEnterpriseBehaviouralEnabled: boolean | null
  currentEnterpriseUniformInventoryEnabled: boolean | null
  currentEnterpriseWhiteLabelEnabled: boolean | null
  currentEnterpriseGoogleClassroomEnabled: boolean | null
  currentEnterpriseFeesMonthly: number | null
  currentEnterpriseLibraryMonthly: number | null
  currentEnterpriseBehaviouralMonthly: number | null
  currentEnterpriseUniformInventoryMonthly: number | null
  currentEnterpriseWhiteLabelMonthly: number | null
  currentEnterpriseGoogleClassroomMonthly: number | null
  setupFeePaidUsd: number | null
  firstSubscriptionStartDate: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  created: boolean
  usageCreated: boolean
  warnings: string[]
}

export type AlmaSubscriptionTenant = {
  id: string
  name: string | null
  email: string | null
  subdomain: string | null
}

export type AlmaSubscriptionGetResult = {
  tenant: AlmaSubscriptionTenant | null
  subscription: AlmaSubscriptionSnapshot | null
  notes: string[]
}

export type AlmaEnterprisePutResult = {
  upserted: boolean
  created: boolean
  tenant: AlmaSubscriptionTenant | null
  subscription: AlmaSubscriptionSnapshot | null
  notes: string[]
}

export type AlmaEnterpriseClearResult = {
  cleared: boolean
  tenant: AlmaSubscriptionTenant | null
  subscription: AlmaSubscriptionSnapshot | null
  notes: string[]
}

export type AlmaAdminTenantTab =
  | 'overview'
  | 'reports'
  | 'subscription'
  | 'delete'
  | 'logs'

const TENANT_TABS: ReadonlySet<AlmaAdminTenantTab> = new Set([
  'overview',
  'reports',
  'subscription',
  'delete',
  'logs',
])

export function isAlmaAdminTenantTab(
  value: string | null | undefined
): value is AlmaAdminTenantTab {
  return typeof value === 'string' && TENANT_TABS.has(value as AlmaAdminTenantTab)
}

export function parseAlmaTenantTab(
  value: string | null | undefined
): AlmaAdminTenantTab {
  return isAlmaAdminTenantTab(value) ? value : 'overview'
}

export function isAlmaAdminEnv(
  value: string | null | undefined
): value is AlmaAdminEnv {
  return value === 'staging' || value === 'production'
}

/** Default production — Alma staging is not ready yet. */
export function parseAlmaAdminEnv(
  value: string | null | undefined,
  fallback: AlmaAdminEnv = 'production'
): AlmaAdminEnv {
  return isAlmaAdminEnv(value) ? value : fallback
}

export function metaString(
  meta: AlmaApiHitMetadata,
  key: string
): string | null {
  const v = meta[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

export function metaNumber(
  meta: AlmaApiHitMetadata,
  key: string
): number | null {
  const v = meta[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}
