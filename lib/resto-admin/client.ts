import type {
  RestoAdminEnv,
  RestoApiHit,
  RestoApiHitMetadata,
  RestoEnterpriseOfferInput,
  RestoEnterprisePutResult,
  RestoLogsPage,
  RestoLogsQuery,
  RestoSubscriptionGetResult,
  RestoSubscriptionSnapshot,
  RestoSubscriptionTenant,
  RestoTenant,
  RestoTenantDeleteResult,
  RestoTenantDeleteSummary,
} from '@/lib/resto-admin/types'

export class RestoAdminConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RestoAdminConfigError'
  }
}

export class RestoAdminApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RestoAdminApiError'
    this.status = status
  }
}

function envConfig(env: RestoAdminEnv): { baseUrl: string; apiKey: string } | null {
  if (env === 'staging') {
    const baseUrl = process.env.RESTO_STAGING_BASE_URL?.trim()
    const apiKey = process.env.RESTO_STAGING_ADMIN_API_KEY?.trim()
    if (!baseUrl || !apiKey) return null
    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
  }

  const baseUrl = process.env.RESTO_PROD_BASE_URL?.trim()
  const apiKey = process.env.RESTO_PROD_ADMIN_API_KEY?.trim()
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export function isRestoAdminConfigured(env: RestoAdminEnv): boolean {
  return envConfig(env) !== null
}

function requireConfig(env: RestoAdminEnv) {
  const config = envConfig(env)
  if (!config) {
    throw new RestoAdminConfigError(
      env === 'staging'
        ? 'Resto Staging admin API is not configured. Set RESTO_STAGING_BASE_URL and RESTO_STAGING_ADMIN_API_KEY.'
        : 'Resto Production admin API is not configured. Set RESTO_PROD_BASE_URL and RESTO_PROD_ADMIN_API_KEY.'
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

  // Nest envelope: { success: false, error: { message, details } }
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
  env: RestoAdminEnv,
  pathWithQuery: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    /** Override default 15s (deletes can run long). */
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
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new RestoAdminApiError(
        `Resto (${env}) timed out after ${Math.round(timeoutMs / 1000)}s — is Nest running at the configured base URL?`,
        504
      )
    }
    const message = err instanceof Error ? err.message : 'Network error'
    throw new RestoAdminApiError(`Could not reach Resto (${env}): ${message}`, 502)
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
    throw new RestoAdminApiError(
      nestErrorMessage(parsed, `Resto admin API returned ${response.status}`),
      response.status
    )
  }

  return { status: response.status, body: parsed }
}

function normalizeTenant(raw: Record<string, unknown>): RestoTenant | null {
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
  }
}

/** Nest returns `{ data: [...] }`; also accept a bare array or `{ tenants: [...] }`. */
function extractTenantRows(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.tenants)) return record.tenants
  return null
}

function normalizeMetadata(value: unknown): RestoApiHitMetadata {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RestoApiHitMetadata
  }
  return {}
}

/** Nest admin logs = api_hits HTTP traffic (not audit_logs). */
function normalizeApiHit(raw: Record<string, unknown>): RestoApiHit | null {
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

/**
 * Server-only: list tenants from Resto Nest for the given environment.
 * Never import this into client components.
 */
export async function fetchRestoTenants(env: RestoAdminEnv): Promise<RestoTenant[]> {
  const { body } = await fetchAdminJson(env, '/api/v1/admin/tenants')
  const rows = extractTenantRows(body)

  if (!rows) {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  return rows
    .map(row =>
      row && typeof row === 'object'
        ? normalizeTenant(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoTenant => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

function clampLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 50
  return Math.min(200, Math.max(1, Math.floor(value)))
}

/**
 * Server-only: list API hits from Resto Nest GET /api/v1/admin/logs.
 * Never import this into client components.
 */
export async function fetchRestoLogs(
  env: RestoAdminEnv,
  query: RestoLogsQuery = {}
): Promise<RestoLogsPage> {
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
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  const record = body as { data: unknown[]; nextCursor?: unknown }
  const logs = record.data
    .map(row =>
      row && typeof row === 'object'
        ? normalizeApiHit(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoApiHit => Boolean(row))

  const nextCursor =
    typeof record.nextCursor === 'string' && record.nextCursor.trim()
      ? record.nextCursor.trim()
      : null

  return { logs, nextCursor }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function normalizeDeletionSummary(
  raw: Record<string, unknown> | null | undefined
): RestoTenantDeleteSummary | null {
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
    ordersDeleted: asNumber(raw.ordersDeleted) ?? asNumber(raw.orders_deleted),
    branchesDeleted:
      asNumber(raw.branchesDeleted) ?? asNumber(raw.branches_deleted),
    apiHitsDeleted:
      asNumber(raw.apiHitsDeleted) ?? asNumber(raw.api_hits_deleted),
    warnings,
    steps,
  }
}

/**
 * Server-only: hard-delete a Resto tenant via Nest DELETE /api/v1/admin/tenants/:id.
 * Body confirmTenantId must match the path id (Nest safety check).
 * Never import this into client components.
 */
export async function deleteRestoTenant(
  env: RestoAdminEnv,
  tenantId: string
): Promise<RestoTenantDeleteResult> {
  const id = tenantId.trim()
  if (!id) {
    throw new RestoAdminApiError('Missing tenant id', 400)
  }

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      body: { confirmTenantId: id, confirm: true },
      // Full tenant wipe can take a while (api_hits, catalog, auth users)
      timeoutMs: 120_000,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
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
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function normalizeSubTenant(
  raw: Record<string, unknown> | null | undefined
): RestoSubscriptionTenant | null {
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
): RestoSubscriptionSnapshot | null {
  if (!raw) return null
  return {
    id: asTrimmedString(raw.id),
    tenantId: asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id),
    planId: asTrimmedString(raw.planId) ?? asTrimmedString(raw.plan_id),
    billingCycle:
      asTrimmedString(raw.billingCycle) ?? asTrimmedString(raw.billing_cycle),
    status: asTrimmedString(raw.status),
    currentPeriodStart:
      asTrimmedString(raw.currentPeriodStart) ??
      asTrimmedString(raw.current_period_start),
    currentPeriodEnd:
      asTrimmedString(raw.currentPeriodEnd) ??
      asTrimmedString(raw.current_period_end),
    trialEndsAt:
      asTrimmedString(raw.trialEndsAt) ?? asTrimmedString(raw.trial_ends_at),
    cancelledAt:
      asTrimmedString(raw.cancelledAt) ?? asTrimmedString(raw.cancelled_at),
    enterpriseEnabled: asBoolean(raw.enterpriseEnabled),
    enterprisePrice: asNumber(raw.enterprisePrice) ?? asNumber(raw.enterprise_price),
    enterpriseDurationMonths:
      asNumber(raw.enterpriseDurationMonths) ??
      asNumber(raw.enterprise_duration_months),
    enterpriseSetupFee:
      asNumber(raw.enterpriseSetupFee) ?? asNumber(raw.enterprise_setup_fee),
    enterpriseLocationsLimit:
      asNumber(raw.enterpriseLocationsLimit) ??
      asNumber(raw.enterprise_locations_limit),
    enterpriseUsersLimit:
      asNumber(raw.enterpriseUsersLimit) ??
      asNumber(raw.enterprise_users_limit),
    enterpriseCountersLimit:
      asNumber(raw.enterpriseCountersLimit) ??
      asNumber(raw.enterprise_counters_limit),
    enterpriseOrdersMonthLimit:
      asNumber(raw.enterpriseOrdersMonthLimit) ??
      asNumber(raw.enterprise_orders_month_limit),
    enterpriseCallcenterEnabled:
      asBoolean(raw.enterpriseCallcenterEnabled) ??
      asBoolean(raw.enterprise_callcenter_enabled),
    enterpriseKdsEnabled:
      asBoolean(raw.enterpriseKdsEnabled) ??
      asBoolean(raw.enterprise_kds_enabled),
    enterpriseInventoryEnabled:
      asBoolean(raw.enterpriseInventoryEnabled) ??
      asBoolean(raw.enterprise_inventory_enabled),
    addonSupportEnabled:
      asBoolean(raw.addonSupportEnabled) ??
      asBoolean(raw.addon_support_enabled),
    addonWebOrderingEnabled:
      asBoolean(raw.addonWebOrderingEnabled) ??
      asBoolean(raw.addon_web_ordering_enabled),
    enterprisePaidTrialEnabled:
      asBoolean(raw.enterprisePaidTrialEnabled) ??
      asBoolean(raw.enterprise_paid_trial_enabled),
    enterprisePaidTrialDurationDays:
      asNumber(raw.enterprisePaidTrialDurationDays) ??
      asNumber(raw.enterprise_paid_trial_duration_days),
    enterprisePreTrialSetupFee:
      asNumber(raw.enterprisePreTrialSetupFee) ??
      asNumber(raw.enterprise_pre_trial_setup_fee),
    enterprisePostTrialSetupFee:
      asNumber(raw.enterprisePostTrialSetupFee) ??
      asNumber(raw.enterprise_post_trial_setup_fee),
    enterpriseAccessStartsAt:
      asTrimmedString(raw.enterpriseAccessStartsAt) ??
      asTrimmedString(raw.enterprise_access_starts_at),
    currentEnterprisePrice:
      asNumber(raw.currentEnterprisePrice) ??
      asNumber(raw.current_enterprise_price),
    currentEnterpriseDurationMonths:
      asNumber(raw.currentEnterpriseDurationMonths) ??
      asNumber(raw.current_enterprise_duration_months),
    currentEnterpriseLocationsLimit:
      asNumber(raw.currentEnterpriseLocationsLimit) ??
      asNumber(raw.current_enterprise_locations_limit),
    currentEnterpriseUsersLimit:
      asNumber(raw.currentEnterpriseUsersLimit) ??
      asNumber(raw.current_enterprise_users_limit),
    currentEnterpriseCountersLimit:
      asNumber(raw.currentEnterpriseCountersLimit) ??
      asNumber(raw.current_enterprise_counters_limit),
    currentEnterpriseOrdersMonthLimit:
      asNumber(raw.currentEnterpriseOrdersMonthLimit) ??
      asNumber(raw.current_enterprise_orders_month_limit),
    currentEnterpriseCallcenterEnabled:
      asBoolean(raw.currentEnterpriseCallcenterEnabled) ??
      asBoolean(raw.current_enterprise_callcenter_enabled),
    currentEnterpriseKdsEnabled:
      asBoolean(raw.currentEnterpriseKdsEnabled) ??
      asBoolean(raw.current_enterprise_kds_enabled),
    currentEnterpriseInventoryEnabled:
      asBoolean(raw.currentEnterpriseInventoryEnabled) ??
      asBoolean(raw.current_enterprise_inventory_enabled),
    currentEnterpriseSupportEnabled:
      asBoolean(raw.currentEnterpriseSupportEnabled) ??
      asBoolean(raw.current_enterprise_support_enabled),
    currentEnterpriseWebOrderingEnabled:
      asBoolean(raw.currentEnterpriseWebOrderingEnabled) ??
      asBoolean(raw.current_enterprise_web_ordering_enabled),
    stripeSubscriptionId:
      asTrimmedString(raw.stripeSubscriptionId) ??
      asTrimmedString(raw.stripe_subscription_id),
    stripeCustomerId:
      asTrimmedString(raw.stripeCustomerId) ??
      asTrimmedString(raw.stripe_customer_id),
    created: raw.created === true,
    usageCreated: raw.usageCreated === true || raw.usage_created === true,
    warnings: asStringArray(raw.warnings),
  }
}

/**
 * Map Nest subscription snapshot → complete Enterprise PUT body for the form.
 */
export function offerFromSubscription(
  sub: RestoSubscriptionSnapshot | null
): RestoEnterpriseOfferInput {
  if (!sub) {
    return {
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
  }

  const paidTrial = sub.enterprisePaidTrialEnabled === true
  return {
    price: sub.enterprisePrice ?? 420,
    durationMonths: sub.enterpriseDurationMonths ?? 12,
    setupFee: sub.enterpriseSetupFee ?? 0,
    locations: sub.enterpriseLocationsLimit,
    users: sub.enterpriseUsersLimit,
    counters: sub.enterpriseCountersLimit,
    ordersPerMonth: sub.enterpriseOrdersMonthLimit,
    callCenter: sub.enterpriseCallcenterEnabled,
    kds: sub.enterpriseKdsEnabled,
    inventory: sub.enterpriseInventoryEnabled,
    support: sub.addonSupportEnabled,
    webOrdering: sub.addonWebOrderingEnabled,
    paidTrial,
    paidTrialDays: paidTrial ? sub.enterprisePaidTrialDurationDays : null,
    preTrialSetupFee: sub.enterprisePreTrialSetupFee,
    postTrialSetupFee: sub.enterprisePostTrialSetupFee,
    accessStartsAt: paidTrial ? null : sub.enterpriseAccessStartsAt,
    enterpriseEnabled: sub.enterpriseEnabled !== false,
  }
}

/**
 * Server-only: GET tenant subscription + Enterprise offer.
 * Never import into client components.
 */
export async function fetchRestoTenantSubscription(
  env: RestoAdminEnv,
  tenantId: string
): Promise<RestoSubscriptionGetResult> {
  const id = tenantId.trim()
  if (!id) throw new RestoAdminApiError('Missing tenant id', 400)

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/subscription`
  )

  if (!body || typeof body !== 'object') {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
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

/**
 * Server-only: PUT full Enterprise offer (creates free shell if needed).
 * Never import into client components.
 */
export async function putRestoEnterpriseOffer(
  env: RestoAdminEnv,
  tenantId: string,
  offer: RestoEnterpriseOfferInput
): Promise<RestoEnterprisePutResult> {
  const id = tenantId.trim()
  if (!id) throw new RestoAdminApiError('Missing tenant id', 400)

  // Nest DB enforces NOT NULL on pre/post trial setup fee columns
  const payload: RestoEnterpriseOfferInput = {
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
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
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
