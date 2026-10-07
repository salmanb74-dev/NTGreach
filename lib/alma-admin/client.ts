import type {
  AlmaAdminEnv,
  AlmaApiHit,
  AlmaApiHitMetadata,
  AlmaAssessmentsLockPutResult,
  AlmaAssessmentsLockStatus,
  AlmaEnterpriseClearResult,
  AlmaEnterpriseOfferInput,
  AlmaEnterprisePutResult,
  AlmaLogsPage,
  AlmaLogsQuery,
  AlmaSubscriptionGetResult,
  AlmaSubscriptionSnapshot,
  AlmaSubscriptionTenant,
  AlmaTenant,
  AlmaTenantDeleteResult,
  AlmaTenantDeleteSummary,
} from '@/lib/alma-admin/types'

export class AlmaAdminConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlmaAdminConfigError'
  }
}

export class AlmaAdminApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AlmaAdminApiError'
    this.status = status
  }
}

function envConfig(env: AlmaAdminEnv): { baseUrl: string; apiKey: string } | null {
  if (env === 'staging') {
    const baseUrl = process.env.ALMA_STAGING_BASE_URL?.trim()
    const apiKey = process.env.ALMA_STAGING_ADMIN_API_KEY?.trim()
    if (!baseUrl || !apiKey) return null
    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
  }

  const baseUrl = process.env.ALMA_PROD_BASE_URL?.trim()
  const apiKey = process.env.ALMA_PROD_ADMIN_API_KEY?.trim()
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export function isAlmaAdminConfigured(env: AlmaAdminEnv): boolean {
  return envConfig(env) !== null
}

function requireConfig(env: AlmaAdminEnv) {
  const config = envConfig(env)
  if (!config) {
    throw new AlmaAdminConfigError(
      env === 'staging'
        ? 'Alma Staging admin API is not configured. Set ALMA_STAGING_BASE_URL and ALMA_STAGING_ADMIN_API_KEY.'
        : 'Alma Production admin API is not configured. Set ALMA_PROD_BASE_URL and ALMA_PROD_ADMIN_API_KEY.'
    )
  }
  return config
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function nestErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim()
  }

  if (record.error && typeof record.error === 'object' && !Array.isArray(record.error)) {
    const errObj = record.error as Record<string, unknown>
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message.trim()
    }
    const details = errObj.details
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const d = details as Record<string, unknown>
      if (typeof d.message === 'string' && d.message.trim()) {
        return d.message.trim()
      }
    }
  }

  const message = record.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  if (Array.isArray(message)) {
    const parts = message
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }

  return fallback
}

async function fetchAdminJson(
  env: AlmaAdminEnv,
  pathWithQuery: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    timeoutMs?: number
  } = {}
): Promise<{ status: number; body: unknown }> {
  const config = requireConfig(env)
  const url = `${config.baseUrl}${pathWithQuery}`
  const method = init.method ?? 'GET'
  const timeoutMs = init.timeoutMs ?? 15_000

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': config.apiKey,
  }
  let body: string | undefined
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const cause =
      err && typeof err === 'object' && 'cause' in err
        ? (err as { cause?: unknown }).cause
        : undefined
    const causeCode =
      cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code?: unknown }).code ?? '')
        : ''
    const causeName =
      cause instanceof Error
        ? cause.name
        : err instanceof Error
          ? err.name
          : ''

    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        causeName === 'TimeoutError' ||
        causeName === 'AbortError' ||
        causeName === 'ConnectTimeoutError' ||
        causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
        causeCode === 'UND_ERR_HEADERS_TIMEOUT' ||
        causeCode === 'UND_ERR_BODY_TIMEOUT')
    ) {
      const connectish =
        causeName === 'ConnectTimeoutError' ||
        causeCode === 'UND_ERR_CONNECT_TIMEOUT'
      throw new AlmaAdminApiError(
        connectish
          ? `Alma (${env}) timed out connecting to Nest — check ALMA_${env === 'staging' ? 'STAGING' : 'PROD'}_BASE_URL is reachable and Nest is up.`
          : `Alma (${env}) timed out waiting for Nest (operation may still have completed).`,
        504
      )
    }
    const message = err instanceof Error ? err.message : 'Network error'
    throw new AlmaAdminApiError(`Could not reach Alma (${env}): ${message}`, 502)
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    throw new AlmaAdminApiError(
      nestErrorMessage(parsed, `Alma admin API returned ${response.status}`),
      response.status
    )
  }

  return { status: response.status, body: parsed }
}

function asDateOnly(value: unknown): string | null {
  const raw = asTrimmedString(value)
  return raw ? raw.slice(0, 10) : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function pickNumber(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const n = asNumber(raw[key])
    if (n != null) return n
  }
  return null
}

function pickBoolean(raw: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const b = asBoolean(raw[key])
    if (b != null) return b
  }
  return null
}

function normalizeTenant(raw: Record<string, unknown>): AlmaTenant | null {
  const id = asTrimmedString(raw.id)
  if (!id) return null

  const name =
    asTrimmedString(raw.name) ??
    asTrimmedString(raw.tenantName) ??
    id

  const ownerName =
    asTrimmedString(raw.ownerName) ?? asTrimmedString(raw.owner_name)

  const ownerEmail =
    asTrimmedString(raw.ownerEmail) ?? asTrimmedString(raw.owner_email)

  return {
    id,
    name,
    ownerName,
    ownerEmail,
    planId: asTrimmedString(raw.planId) ?? asTrimmedString(raw.plan_id),
    planStatus:
      asTrimmedString(raw.planStatus) ?? asTrimmedString(raw.plan_status),
    enterpriseInPaidTrial: asBoolean(
      raw.enterpriseInPaidTrial ?? raw.enterprise_in_paid_trial
    ),
    subscriptionStart: asDateOnly(
      raw.subscriptionStart ?? raw.subscription_start
    ),
    firstSubscriptionStartDate: asDateOnly(
      raw.firstSubscriptionStartDate ?? raw.first_subscription_start_date
    ),
    trialStartedAt: asDateOnly(
      raw.trialStartedAt ?? raw.trial_started_at
    ),
    billingCycle:
      asTrimmedString(raw.billingCycle) ?? asTrimmedString(raw.billing_cycle),
    branchesUsed:
      asNumber(raw.branchesUsed) ?? asNumber(raw.branches_used),
    branchesLimit:
      asNumber(raw.branchesLimit) ?? asNumber(raw.branches_limit),
    studentsUsed:
      asNumber(raw.studentsUsed) ?? asNumber(raw.students_used),
    studentsLimit:
      asNumber(raw.studentsLimit) ?? asNumber(raw.students_limit),
    storageGbUsed:
      asNumber(raw.storageGbUsed) ??
      asNumber(raw.storage_gb_used) ??
      asNumber(raw.storageUsed) ??
      asNumber(raw.storage_used),
    storageGbLimit:
      asNumber(raw.storageGbLimit) ??
      asNumber(raw.storage_gb_limit) ??
      asNumber(raw.storageLimit) ??
      asNumber(raw.storage_limit),
    assessmentsCreationLocked:
      asBoolean(
        raw.assessmentsCreationLocked ?? raw.assessments_creation_locked
      ) === true,
  }
}

function extractTenantRows(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.tenants)) return record.tenants
  return null
}

function normalizeMetadata(value: unknown): AlmaApiHitMetadata {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as AlmaApiHitMetadata
  }
  return {}
}

function normalizeApiHit(raw: Record<string, unknown>): AlmaApiHit | null {
  const id = asTrimmedString(raw.id)
  const actionType =
    asTrimmedString(raw.actionType) ?? asTrimmedString(raw.action_type)
  const createdAt =
    asTrimmedString(raw.createdAt) ?? asTrimmedString(raw.created_at)

  if (!id || !actionType || !createdAt) return null

  return {
    id,
    tenantId: asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id),
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    branchId: asTrimmedString(raw.branchId) ?? asTrimmedString(raw.branch_id),
    userId: asTrimmedString(raw.userId) ?? asTrimmedString(raw.user_id),
    userName: asTrimmedString(raw.userName) ?? asTrimmedString(raw.user_name),
    userEmail: asTrimmedString(raw.userEmail) ?? asTrimmedString(raw.user_email),
    actionType,
    metadata: normalizeMetadata(raw.metadata),
    createdAt,
  }
}

export async function fetchAlmaTenants(env: AlmaAdminEnv): Promise<AlmaTenant[]> {
  const { body } = await fetchAdminJson(env, '/api/v1/admin/tenants')
  const rows = extractTenantRows(body)

  if (!rows) {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  return rows
    .map(row =>
      row && typeof row === 'object'
        ? normalizeTenant(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is AlmaTenant => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

function clampLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 50
  return Math.min(200, Math.max(1, Math.floor(value)))
}

export async function fetchAlmaLogs(
  env: AlmaAdminEnv,
  query: AlmaLogsQuery = {}
): Promise<AlmaLogsPage> {
  const params = new URLSearchParams()
  const limit = clampLimit(query.limit)
  params.set('limit', String(limit))

  if (query.tenantId?.trim()) params.set('tenantId', query.tenantId.trim())
  if (query.actionType?.trim()) params.set('actionType', query.actionType.trim())
  if (query.method?.trim()) params.set('method', query.method.trim().toUpperCase())
  if (query.statusCode != null && String(query.statusCode).trim() !== '') {
    params.set('statusCode', String(query.statusCode).trim())
  }
  if (query.from?.trim()) params.set('from', query.from.trim())
  if (query.to?.trim()) params.set('to', query.to.trim())
  if (query.cursor?.trim()) params.set('cursor', query.cursor.trim())

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/logs?${params.toString()}`
  )

  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const record = body as { data: unknown[]; nextCursor?: unknown }
  const logs = record.data
    .map(row =>
      row && typeof row === 'object'
        ? normalizeApiHit(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is AlmaApiHit => Boolean(row))

  const nextCursor =
    typeof record.nextCursor === 'string' && record.nextCursor.trim()
      ? record.nextCursor.trim()
      : null

  return { logs, nextCursor }
}

function normalizeDeletionSummary(
  raw: Record<string, unknown> | null | undefined
): AlmaTenantDeleteSummary | null {
  if (!raw) return null
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    : []
  const steps = Array.isArray(raw.steps)
    ? raw.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []

  return {
    tenantId:
      asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id),
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    tenantEmail:
      asTrimmedString(raw.tenantEmail) ?? asTrimmedString(raw.tenant_email),
    usersDeleted: asNumber(raw.usersDeleted) ?? asNumber(raw.users_deleted),
    authUsersDeleted:
      asNumber(raw.authUsersDeleted) ?? asNumber(raw.auth_users_deleted),
    authUsersFailed:
      asNumber(raw.authUsersFailed) ?? asNumber(raw.auth_users_failed),
    studentsDeleted:
      asNumber(raw.studentsDeleted) ?? asNumber(raw.students_deleted),
    branchesDeleted:
      asNumber(raw.branchesDeleted) ?? asNumber(raw.branches_deleted),
    apiHitsDeleted:
      asNumber(raw.apiHitsDeleted) ?? asNumber(raw.api_hits_deleted),
    warnings,
    steps,
  }
}

export async function almaTenantExists(
  env: AlmaAdminEnv,
  tenantId: string
): Promise<boolean> {
  const id = tenantId.trim()
  if (!id) return false
  const tenants = await fetchAlmaTenants(env)
  return tenants.some(t => t.id === id)
}

export async function deleteAlmaTenant(
  env: AlmaAdminEnv,
  tenantId: string
): Promise<AlmaTenantDeleteResult> {
  const id = tenantId.trim()
  if (!id) {
    throw new AlmaAdminApiError('Missing tenant id', 400)
  }

  try {
    const { body } = await fetchAdminJson(
      env,
      `/api/v1/admin/tenants/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: { confirmTenantId: id, confirm: true },
        timeoutMs: 180_000,
      }
    )

    if (!body || typeof body !== 'object') {
      throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
    }

    const record = body as Record<string, unknown>
    const summaryRaw =
      record.summary && typeof record.summary === 'object'
        ? (record.summary as Record<string, unknown>)
        : null

    return {
      deleted: record.deleted === true || record.deleted === 'true',
      tenantId:
        asTrimmedString(record.tenantId) ??
        asTrimmedString(record.tenant_id) ??
        id,
      tenantName:
        asTrimmedString(record.tenantName) ??
        asTrimmedString(record.tenant_name),
      summary: normalizeDeletionSummary(summaryRaw),
    }
  } catch (err) {
    if (err instanceof AlmaAdminApiError && err.status === 404) {
      return {
        deleted: true,
        tenantId: id,
        tenantName: null,
        summary: null,
        confirmedAbsent: true,
      }
    }

    const timedOut =
      err instanceof AlmaAdminApiError && err.status === 504

    if (timedOut) {
      try {
        const stillThere = await almaTenantExists(env, id)
        if (!stillThere) {
          return {
            deleted: true,
            tenantId: id,
            tenantName: null,
            summary: null,
            confirmedAbsent: true,
          }
        }
      } catch {
        // Verification failed — fall through.
      }
    }

    throw err
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function normalizeSubTenant(
  raw: Record<string, unknown> | null | undefined
): AlmaSubscriptionTenant | null {
  if (!raw) return null
  const id = asTrimmedString(raw.id)
  if (!id) return null
  return {
    id,
    name: asTrimmedString(raw.name),
    email: asTrimmedString(raw.email),
    subdomain: asTrimmedString(raw.subdomain),
  }
}

function normalizeSubscription(
  raw: Record<string, unknown> | null | undefined
): AlmaSubscriptionSnapshot | null {
  if (!raw) return null
  const r = raw
  return {
    id: asTrimmedString(r.id),
    tenantId: asTrimmedString(r.tenantId) ?? asTrimmedString(r.tenant_id),
    planId: asTrimmedString(r.planId) ?? asTrimmedString(r.plan_id),
    billingCycle:
      asTrimmedString(r.billingCycle) ?? asTrimmedString(r.billing_cycle),
    status: asTrimmedString(r.status),
    currentPeriodStart:
      asTrimmedString(r.currentPeriodStart) ??
      asTrimmedString(r.current_period_start),
    currentPeriodEnd:
      asTrimmedString(r.currentPeriodEnd) ??
      asTrimmedString(r.current_period_end),
    trialEndsAt:
      asTrimmedString(r.trialEndsAt) ?? asTrimmedString(r.trial_ends_at),
    trialStartedAt:
      asTrimmedString(r.trialStartedAt) ??
      asTrimmedString(r.trial_started_at),
    cancelledAt:
      asTrimmedString(r.cancelledAt) ?? asTrimmedString(r.cancelled_at),
    enterpriseEnabled: asBoolean(r.enterpriseEnabled),
    enterprisePrice: asNumber(r.enterprisePrice) ?? asNumber(r.enterprise_price),
    enterpriseDurationMonths:
      asNumber(r.enterpriseDurationMonths) ??
      asNumber(r.enterprise_duration_months),
    enterpriseSetupFee:
      asNumber(r.enterpriseSetupFee) ?? asNumber(r.enterprise_setup_fee),
    enterpriseBranchesLimit: pickNumber(
      r,
      'enterpriseBranchesLimit',
      'enterprise_branches_limit'
    ),
    enterpriseStudentsLimit: pickNumber(
      r,
      'enterpriseStudentsLimit',
      'enterprise_students_limit'
    ),
    enterpriseStorageGbLimit: pickNumber(
      r,
      'enterpriseStorageGbLimit',
      'enterprise_storage_gb_limit',
      'enterpriseStorageLimit',
      'enterprise_storage_limit'
    ),
    enterpriseFeesEnabled: pickBoolean(
      r,
      'enterpriseFeesEnabled',
      'enterprise_fees_enabled',
      'feesEnabled',
      'fees_enabled'
    ),
    enterpriseLibraryEnabled: pickBoolean(
      r,
      'enterpriseLibraryEnabled',
      'enterprise_library_enabled',
      'libraryEnabled',
      'library_enabled'
    ),
    enterpriseBehaviouralEnabled: pickBoolean(
      r,
      'enterpriseBehaviouralEnabled',
      'enterprise_behavioural_enabled',
      'behaviouralEnabled',
      'behavioural_enabled'
    ),
    enterpriseUniformInventoryEnabled: pickBoolean(
      r,
      'enterpriseUniformInventoryEnabled',
      'enterprise_uniform_inventory_enabled',
      'uniformInventoryEnabled',
      'uniform_inventory_enabled'
    ),
    enterpriseWhiteLabelEnabled: pickBoolean(
      r,
      'enterpriseWhiteLabelEnabled',
      'enterprise_white_label_enabled',
      'whiteLabelEnabled',
      'white_label_enabled'
    ),
    enterpriseGoogleClassroomEnabled: pickBoolean(
      r,
      'enterpriseGoogleClassroomEnabled',
      'enterprise_google_classroom_enabled',
      'googleClassroomEnabled',
      'google_classroom_enabled'
    ),
    enterpriseFeesMonthly: pickNumber(
      r,
      'enterpriseFeesMonthly',
      'enterprise_fees_monthly',
      'feesMonthly',
      'fees_monthly'
    ),
    enterpriseLibraryMonthly: pickNumber(
      r,
      'enterpriseLibraryMonthly',
      'enterprise_library_monthly',
      'libraryMonthly',
      'library_monthly'
    ),
    enterpriseBehaviouralMonthly: pickNumber(
      r,
      'enterpriseBehaviouralMonthly',
      'enterprise_behavioural_monthly',
      'behaviouralMonthly',
      'behavioural_monthly'
    ),
    enterpriseUniformInventoryMonthly: pickNumber(
      r,
      'enterpriseUniformInventoryMonthly',
      'enterprise_uniform_inventory_monthly',
      'uniformInventoryMonthly',
      'uniform_inventory_monthly'
    ),
    enterpriseWhiteLabelMonthly: pickNumber(
      r,
      'enterpriseWhiteLabelMonthly',
      'enterprise_white_label_monthly',
      'whiteLabelMonthly',
      'white_label_monthly'
    ),
    enterpriseGoogleClassroomMonthly: pickNumber(
      r,
      'enterpriseGoogleClassroomMonthly',
      'enterprise_google_classroom_monthly',
      'googleClassroomMonthly',
      'google_classroom_monthly'
    ),
    enterprisePaidTrialEnabled:
      asBoolean(r.enterprisePaidTrialEnabled) ??
      asBoolean(r.enterprise_paid_trial_enabled),
    enterprisePaidTrialDurationDays:
      asNumber(r.enterprisePaidTrialDurationDays) ??
      asNumber(r.enterprise_paid_trial_duration_days),
    enterpriseInPaidTrial:
      asBoolean(r.enterpriseInPaidTrial) ??
      asBoolean(r.enterprise_in_paid_trial),
    enterprisePreTrialSetupFee:
      asNumber(r.enterprisePreTrialSetupFee) ??
      asNumber(r.enterprise_pre_trial_setup_fee),
    enterprisePostTrialSetupFee:
      asNumber(r.enterprisePostTrialSetupFee) ??
      asNumber(r.enterprise_post_trial_setup_fee),
    enterpriseAccessStartsAt:
      asTrimmedString(r.enterpriseAccessStartsAt) ??
      asTrimmedString(r.enterprise_access_starts_at),
    enterpriseTrialStartsAt:
      asTrimmedString(r.enterpriseTrialStartsAt) ??
      asTrimmedString(r.enterprise_trial_starts_at),
    prorateBackdatedAccess:
      asBoolean(r.prorateBackdatedAccess) ??
      asBoolean(r.enterprise_prorate_backdated_access) ??
      asBoolean(r.prorate_backdated_access),
    currentEnterprisePrice:
      asNumber(r.currentEnterprisePrice) ??
      asNumber(r.current_enterprise_price),
    currentEnterpriseDurationMonths:
      asNumber(r.currentEnterpriseDurationMonths) ??
      asNumber(r.current_enterprise_duration_months),
    currentEnterpriseBranchesLimit: pickNumber(
      r,
      'currentEnterpriseBranchesLimit',
      'current_enterprise_branches_limit'
    ),
    currentEnterpriseStudentsLimit: pickNumber(
      r,
      'currentEnterpriseStudentsLimit',
      'current_enterprise_students_limit'
    ),
    currentEnterpriseStorageGbLimit: pickNumber(
      r,
      'currentEnterpriseStorageGbLimit',
      'current_enterprise_storage_gb_limit',
      'currentEnterpriseStorageLimit',
      'current_enterprise_storage_limit'
    ),
    currentEnterpriseFeesEnabled: pickBoolean(
      r,
      'currentEnterpriseFeesEnabled',
      'current_enterprise_fees_enabled',
      'currentFeesEnabled',
      'current_fees_enabled'
    ),
    currentEnterpriseLibraryEnabled: pickBoolean(
      r,
      'currentEnterpriseLibraryEnabled',
      'current_enterprise_library_enabled',
      'currentLibraryEnabled',
      'current_library_enabled'
    ),
    currentEnterpriseBehaviouralEnabled: pickBoolean(
      r,
      'currentEnterpriseBehaviouralEnabled',
      'current_enterprise_behavioural_enabled',
      'currentBehaviouralEnabled',
      'current_behavioural_enabled'
    ),
    currentEnterpriseUniformInventoryEnabled: pickBoolean(
      r,
      'currentEnterpriseUniformInventoryEnabled',
      'current_enterprise_uniform_inventory_enabled',
      'currentUniformInventoryEnabled',
      'current_uniform_inventory_enabled'
    ),
    currentEnterpriseWhiteLabelEnabled: pickBoolean(
      r,
      'currentEnterpriseWhiteLabelEnabled',
      'current_enterprise_white_label_enabled',
      'currentWhiteLabelEnabled',
      'current_white_label_enabled'
    ),
    currentEnterpriseGoogleClassroomEnabled: pickBoolean(
      r,
      'currentEnterpriseGoogleClassroomEnabled',
      'current_enterprise_google_classroom_enabled',
      'currentGoogleClassroomEnabled',
      'current_google_classroom_enabled'
    ),
    currentEnterpriseFeesMonthly: pickNumber(
      r,
      'currentEnterpriseFeesMonthly',
      'current_enterprise_fees_monthly',
      'currentFeesMonthly',
      'current_fees_monthly'
    ),
    currentEnterpriseLibraryMonthly: pickNumber(
      r,
      'currentEnterpriseLibraryMonthly',
      'current_enterprise_library_monthly',
      'currentLibraryMonthly',
      'current_library_monthly'
    ),
    currentEnterpriseBehaviouralMonthly: pickNumber(
      r,
      'currentEnterpriseBehaviouralMonthly',
      'current_enterprise_behavioural_monthly',
      'currentBehaviouralMonthly',
      'current_behavioural_monthly'
    ),
    currentEnterpriseUniformInventoryMonthly: pickNumber(
      r,
      'currentEnterpriseUniformInventoryMonthly',
      'current_enterprise_uniform_inventory_monthly',
      'currentUniformInventoryMonthly',
      'current_uniform_inventory_monthly'
    ),
    currentEnterpriseWhiteLabelMonthly: pickNumber(
      r,
      'currentEnterpriseWhiteLabelMonthly',
      'current_enterprise_white_label_monthly',
      'currentWhiteLabelMonthly',
      'current_white_label_monthly'
    ),
    currentEnterpriseGoogleClassroomMonthly: pickNumber(
      r,
      'currentEnterpriseGoogleClassroomMonthly',
      'current_enterprise_google_classroom_monthly',
      'currentGoogleClassroomMonthly',
      'current_google_classroom_monthly'
    ),
    setupFeePaidUsd:
      asNumber(r.setupFeePaidUsd) ??
      asNumber(r.setup_fee_paid_usd),
    firstSubscriptionStartDate: asDateOnly(
      r.firstSubscriptionStartDate ?? r.first_subscription_start_date
    ),
    stripeSubscriptionId:
      asTrimmedString(r.stripeSubscriptionId) ??
      asTrimmedString(r.stripe_subscription_id),
    stripeCustomerId:
      asTrimmedString(r.stripeCustomerId) ??
      asTrimmedString(r.stripe_customer_id),
    created: r.created === true,
    usageCreated: r.usageCreated === true || r.usage_created === true,
    warnings: asStringArray(r.warnings),
  }
}

export function offerFromSubscription(
  sub: AlmaSubscriptionSnapshot | null
): AlmaEnterpriseOfferInput {
  if (!sub) {
    return {
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
  }

  const paidTrial = sub.enterprisePaidTrialEnabled === true
  return {
    price: sub.enterprisePrice ?? 420,
    durationMonths: sub.enterpriseDurationMonths ?? 12,
    setupFee: sub.enterpriseSetupFee ?? 0,
    branches: sub.enterpriseBranchesLimit,
    students: sub.enterpriseStudentsLimit,
    storageGb: sub.enterpriseStorageGbLimit,
    fees: sub.enterpriseFeesEnabled,
    library: sub.enterpriseLibraryEnabled,
    behavioural: sub.enterpriseBehaviouralEnabled,
    uniformInventory: sub.enterpriseUniformInventoryEnabled,
    whiteLabel: sub.enterpriseWhiteLabelEnabled,
    googleClassroom: sub.enterpriseGoogleClassroomEnabled,
    feesMonthly: sub.enterpriseFeesMonthly,
    libraryMonthly: sub.enterpriseLibraryMonthly,
    behaviouralMonthly: sub.enterpriseBehaviouralMonthly,
    uniformInventoryMonthly: sub.enterpriseUniformInventoryMonthly,
    whiteLabelMonthly: sub.enterpriseWhiteLabelMonthly,
    googleClassroomMonthly: sub.enterpriseGoogleClassroomMonthly,
    paidTrial,
    paidTrialDays: null,
    preTrialSetupFee: sub.enterprisePreTrialSetupFee,
    postTrialSetupFee: 0,
    accessStartsAt: sub.enterpriseAccessStartsAt,
    trialStartsAt: sub.enterpriseTrialStartsAt,
    prorateBackdatedAccess: paidTrial
      ? null
      : sub.prorateBackdatedAccess === false
        ? false
        : true,
    enterpriseEnabled: sub.enterpriseEnabled !== false,
  }
}

export async function fetchAlmaTenantSubscription(
  env: AlmaAdminEnv,
  tenantId: string
): Promise<AlmaSubscriptionGetResult> {
  const id = tenantId.trim()
  if (!id) throw new AlmaAdminApiError('Missing tenant id', 400)

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/subscription`
  )

  if (!body || typeof body !== 'object') {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const subRaw =
    record.subscription && typeof record.subscription === 'object'
      ? (record.subscription as Record<string, unknown>)
      : null
  const tenantRaw =
    record.tenant && typeof record.tenant === 'object'
      ? (record.tenant as Record<string, unknown>)
      : null

  return {
    tenant: normalizeSubTenant(tenantRaw),
    subscription: normalizeSubscription(subRaw),
    notes: asStringArray(record.notes),
  }
}

export async function putAlmaEnterpriseOffer(
  env: AlmaAdminEnv,
  tenantId: string,
  offer: AlmaEnterpriseOfferInput
): Promise<AlmaEnterprisePutResult> {
  const id = tenantId.trim()
  if (!id) throw new AlmaAdminApiError('Missing tenant id', 400)

  const payload: AlmaEnterpriseOfferInput = {
    ...offer,
    setupFee: offer.setupFee ?? 0,
    preTrialSetupFee: offer.preTrialSetupFee ?? 0,
    postTrialSetupFee: offer.postTrialSetupFee ?? 0,
  }

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/subscription/enterprise`,
    {
      method: 'PUT',
      body: payload,
      timeoutMs: 30_000,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const subRaw =
    record.subscription && typeof record.subscription === 'object'
      ? (record.subscription as Record<string, unknown>)
      : null
  const tenantRaw =
    record.tenant && typeof record.tenant === 'object'
      ? (record.tenant as Record<string, unknown>)
      : null

  return {
    upserted: record.upserted === true || record.upserted === 'true' || true,
    created: record.created === true || record.created === 'true',
    tenant: normalizeSubTenant(tenantRaw),
    subscription: normalizeSubscription(subRaw),
    notes: asStringArray(record.notes),
  }
}

function normalizeAssessmentsLock(
  raw: Record<string, unknown>,
  fallbackTenantId?: string
): AlmaAssessmentsLockStatus | null {
  const tenantId =
    asTrimmedString(raw.tenantId) ??
    asTrimmedString(raw.tenant_id) ??
    (fallbackTenantId?.trim() || null)
  if (!tenantId) return null

  const locked = asBoolean(raw.locked)
  if (locked == null) return null

  return {
    tenantId,
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    subdomain: asTrimmedString(raw.subdomain),
    locked,
    lockedAt: asTrimmedString(raw.lockedAt) ?? asTrimmedString(raw.locked_at),
    reason: asTrimmedString(raw.reason),
  }
}

export async function fetchAlmaAssessmentsLock(
  env: AlmaAdminEnv,
  tenantId: string
): Promise<AlmaAssessmentsLockStatus> {
  const id = tenantId.trim()
  if (!id) throw new AlmaAdminApiError('Missing tenant id', 400)

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/assessments-lock`
  )

  if (!body || typeof body !== 'object') {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const status = normalizeAssessmentsLock(body as Record<string, unknown>, id)
  if (!status) {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }
  return status
}

export async function putAlmaAssessmentsLock(
  env: AlmaAdminEnv,
  tenantId: string,
  input: { locked: boolean; reason?: string | null }
): Promise<AlmaAssessmentsLockPutResult> {
  const id = tenantId.trim()
  if (!id) throw new AlmaAdminApiError('Missing tenant id', 400)

  const payload: { locked: boolean; reason?: string } = {
    locked: input.locked === true,
  }
  if (payload.locked) {
    const reason = asTrimmedString(input.reason)
    if (reason) payload.reason = reason
  }

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/assessments-lock`,
    {
      method: 'PUT',
      body: payload,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const status = normalizeAssessmentsLock(record, id)
  if (!status) {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  return {
    ...status,
    changed: record.changed === true || record.changed === 'true',
  }
}

export async function clearAlmaEnterpriseOffer(
  env: AlmaAdminEnv,
  tenantId: string,
  opts: { force?: boolean } = {}
): Promise<AlmaEnterpriseClearResult> {
  const id = tenantId.trim()
  if (!id) throw new AlmaAdminApiError('Missing tenant id', 400)

  const force = opts.force === true
  const qs = force ? '?force=true' : ''

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/subscription/enterprise${qs}`,
    {
      method: 'DELETE',
      body: force ? { force: true } : undefined,
      timeoutMs: 30_000,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new AlmaAdminApiError('Alma admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const subRaw =
    record.subscription && typeof record.subscription === 'object'
      ? (record.subscription as Record<string, unknown>)
      : null
  const tenantRaw =
    record.tenant && typeof record.tenant === 'object'
      ? (record.tenant as Record<string, unknown>)
      : null

  return {
    cleared: record.cleared === true || record.cleared === 'true',
    tenant: normalizeSubTenant(tenantRaw),
    subscription: normalizeSubscription(subRaw),
    notes: asStringArray(record.notes),
  }
}
