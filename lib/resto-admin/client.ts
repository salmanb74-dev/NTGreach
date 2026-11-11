import type {
  RestoAdminEnv,
  RestoAgentVersionsQuery,
  RestoAgentVersionsResult,
  RestoApiHit,
  RestoApiHitMetadata,
  RestoEnterpriseOfferInput,
  RestoEnterprisePutResult,
  RestoEnterpriseClearResult,
  RestoLanTerminal,
  RestoLogsPage,
  RestoLogsQuery,
  RestoOrdersLockPutResult,
  RestoOrdersLockStatus,
  RestoPrintDevice,
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
      throw new RestoAdminApiError(
        connectish
          ? `Resto (${env}) timed out connecting to Nest — check RESTO_${env === 'staging' ? 'STAGING' : 'PROD'}_BASE_URL is reachable and Nest is up.`
          : `Resto (${env}) timed out waiting for Nest (operation may still have completed).`,
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

function asDateOnly(value: unknown): string | null {
  const raw = asTrimmedString(value)
  return raw ? raw.slice(0, 10) : null
}

type RestoTenantFeatureFlags = Pick<
  RestoTenant,
  | 'callCenterEnabled'
  | 'kdsEnabled'
  | 'inventoryEnabled'
  | 'supportEnabled'
  | 'reservationsEnabled'
  | 'chartOfAccountsEnabled'
  | 'webOrderingEnabled'
>

/** Live features first (`currentEnterprise*`), then short aliases Nest may echo. */
function featureFlagsFromRecord(
  raw: Record<string, unknown>
): RestoTenantFeatureFlags {
  return {
    callCenterEnabled: pickBoolean(
      raw,
      'callCenterEnabled',
      'currentEnterpriseCallcenterEnabled',
      'current_enterprise_callcenter_enabled',
      'currentCallCenter',
      'current_call_center',
      'callCenter',
      'call_center'
    ),
    kdsEnabled: pickBoolean(
      raw,
      'kdsEnabled',
      'currentEnterpriseKdsEnabled',
      'current_enterprise_kds_enabled',
      'currentKds',
      'current_kds',
      'kds'
    ),
    inventoryEnabled: pickBoolean(
      raw,
      'inventoryEnabled',
      'currentEnterpriseInventoryEnabled',
      'current_enterprise_inventory_enabled',
      'currentInventory',
      'current_inventory',
      'inventory'
    ),
    supportEnabled: pickBoolean(
      raw,
      'supportEnabled',
      'currentEnterpriseSupportEnabled',
      'current_enterprise_support_enabled',
      'currentSupport',
      'current_support',
      'support',
      'addonSupportEnabled',
      'addon_support_enabled'
    ),
    reservationsEnabled: pickBoolean(
      raw,
      'reservationsEnabled',
      'currentEnterpriseReservationsEnabled',
      'current_enterprise_reservations_enabled',
      'currentReservations',
      'current_reservations',
      'reservations'
    ),
    chartOfAccountsEnabled: pickBoolean(
      raw,
      'chartOfAccountsEnabled',
      'currentEnterpriseChartOfAccountsEnabled',
      'current_enterprise_chart_of_accounts_enabled',
      'currentChartOfAccounts',
      'current_chart_of_accounts',
      'chartOfAccounts',
      'chart_of_accounts'
    ),
    webOrderingEnabled: pickBoolean(
      raw,
      'webOrderingEnabled',
      'currentEnterpriseWebOrderingEnabled',
      'current_enterprise_web_ordering_enabled',
      'currentWebOrdering',
      'current_web_ordering',
      'webOrdering',
      'web_ordering',
      'addonWebOrderingEnabled',
      'addon_web_ordering_enabled'
    ),
  }
}

function tenantHasFeaturePayload(tenant: RestoTenantFeatureFlags): boolean {
  return (
    tenant.callCenterEnabled != null ||
    tenant.kdsEnabled != null ||
    tenant.inventoryEnabled != null ||
    tenant.supportEnabled != null ||
    tenant.reservationsEnabled != null ||
    tenant.chartOfAccountsEnabled != null ||
    tenant.webOrderingEnabled != null
  )
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
    locationsUsed:
      asNumber(raw.locationsUsed) ?? asNumber(raw.locations_used),
    locationsLimit:
      asNumber(raw.locationsLimit) ?? asNumber(raw.locations_limit),
    countersUsed:
      asNumber(raw.countersUsed) ?? asNumber(raw.counters_used),
    countersLimit:
      asNumber(raw.countersLimit) ?? asNumber(raw.counters_limit),
    usersUsed: asNumber(raw.usersUsed) ?? asNumber(raw.users_used),
    usersLimit: asNumber(raw.usersLimit) ?? asNumber(raw.users_limit),
    ordersUsed: asNumber(raw.ordersUsed) ?? asNumber(raw.orders_used),
    ordersLimit: asNumber(raw.ordersLimit) ?? asNumber(raw.orders_limit),
    lastOrderAt: asDateOnly(raw.lastOrderAt ?? raw.last_order_at),
    ordersPlacementLocked:
      asBoolean(
        raw.ordersPlacementLocked ?? raw.orders_placement_locked
      ) === true,
    ...featureFlagsFromRecord(raw),
  }
}

/**
 * Nest tenants list does not yet include live feature flags. Fill from each
 * tenant's subscription GET (batched). Skips tenants that already have flags.
 */
async function enrichTenantsWithFeatures(
  env: RestoAdminEnv,
  tenants: RestoTenant[]
): Promise<RestoTenant[]> {
  const needs = tenants.filter(t => !tenantHasFeaturePayload(t))
  if (needs.length === 0) return tenants

  const byId = new Map<string, RestoTenantFeatureFlags>()
  const concurrency = 8

  for (let i = 0; i < needs.length; i += concurrency) {
    const chunk = needs.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async tenant => {
        try {
          const { body } = await fetchAdminJson(
            env,
            `/api/v1/admin/tenants/${encodeURIComponent(tenant.id)}/subscription`
          )
          if (!body || typeof body !== 'object') return
          const record = body as Record<string, unknown>
          const subRaw =
            record.subscription && typeof record.subscription === 'object'
              ? (record.subscription as Record<string, unknown>)
              : record
          byId.set(tenant.id, featureFlagsFromRecord(subRaw))
        } catch {
          // Leave nulls — Features column shows —
        }
      })
    )
  }

  if (byId.size === 0) return tenants

  return tenants.map(tenant => {
    const flags = byId.get(tenant.id)
    return flags ? { ...tenant, ...flags } : tenant
  })
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

  const tenants = rows
    .map(row =>
      row && typeof row === 'object'
        ? normalizeTenant(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoTenant => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return enrichTenantsWithFeatures(env, tenants)
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

function normalizeLanTerminal(
  raw: Record<string, unknown>
): RestoLanTerminal | null {
  const tenantId =
    asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id)
  if (!tenantId) return null

  return {
    tenantId,
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    branchId: asTrimmedString(raw.branchId) ?? asTrimmedString(raw.branch_id),
    branchName:
      asTrimmedString(raw.branchName) ?? asTrimmedString(raw.branch_name),
    deviceId: asTrimmedString(raw.deviceId) ?? asTrimmedString(raw.device_id),
    deviceName:
      asTrimmedString(raw.deviceName) ??
      asTrimmedString(raw.device_name) ??
      asTrimmedString(raw.name),
    hostsAgent:
      asBoolean(raw.hostsAgent ?? raw.hosts_agent) === true,
    agentVersion:
      asTrimmedString(raw.agentVersion) ?? asTrimmedString(raw.agent_version),
    isServer: asBoolean(raw.isServer ?? raw.is_server) === true,
    lastSeenAt:
      asTrimmedString(raw.lastSeenAt) ?? asTrimmedString(raw.last_seen_at),
    registeredAt:
      asTrimmedString(raw.registeredAt) ?? asTrimmedString(raw.registered_at),
  }
}

function normalizePrintDevice(
  raw: Record<string, unknown>
): RestoPrintDevice | null {
  const tenantId =
    asTrimmedString(raw.tenantId) ?? asTrimmedString(raw.tenant_id)
  if (!tenantId) return null

  return {
    tenantId,
    tenantName:
      asTrimmedString(raw.tenantName) ?? asTrimmedString(raw.tenant_name),
    branchId: asTrimmedString(raw.branchId) ?? asTrimmedString(raw.branch_id),
    branchName:
      asTrimmedString(raw.branchName) ?? asTrimmedString(raw.branch_name),
    deviceId: asTrimmedString(raw.deviceId) ?? asTrimmedString(raw.device_id),
    deviceName:
      asTrimmedString(raw.deviceName) ??
      asTrimmedString(raw.device_name) ??
      asTrimmedString(raw.name),
    agentVersion:
      asTrimmedString(raw.agentVersion) ?? asTrimmedString(raw.agent_version),
    lastSeenAt:
      asTrimmedString(raw.lastSeenAt) ?? asTrimmedString(raw.last_seen_at),
    registeredAt:
      asTrimmedString(raw.registeredAt) ?? asTrimmedString(raw.registered_at),
  }
}

function extractAgentArrays(body: unknown): {
  lanTerminals: unknown[]
  printDevices: unknown[]
} {
  if (!body || typeof body !== 'object') {
    return { lanTerminals: [], printDevices: [] }
  }
  const record = body as Record<string, unknown>
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : record

  const lanTerminals = Array.isArray(data.lanTerminals)
    ? data.lanTerminals
    : Array.isArray(data.lan_terminals)
      ? data.lan_terminals
      : []
  const printDevices = Array.isArray(data.printDevices)
    ? data.printDevices
    : Array.isArray(data.print_devices)
      ? data.print_devices
      : []

  return { lanTerminals, printDevices }
}

/**
 * Server-only: cloud-reported LAN Sync + Print Agent versions.
 * GET /api/v1/admin/agent-versions — never invent versions from manifests.
 * Never import this into client components.
 */
export async function fetchRestoAgentVersions(
  env: RestoAdminEnv,
  query: RestoAgentVersionsQuery = {}
): Promise<RestoAgentVersionsResult> {
  const params = new URLSearchParams()
  if (query.tenantId?.trim()) params.set('tenantId', query.tenantId.trim())
  if (query.q?.trim()) params.set('q', query.q.trim())

  const qs = params.toString()
  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/agent-versions${qs ? `?${qs}` : ''}`
  )

  const { lanTerminals: lanRaw, printDevices: printRaw } =
    extractAgentArrays(body)

  const lanTerminals = lanRaw
    .map(row =>
      row && typeof row === 'object'
        ? normalizeLanTerminal(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoLanTerminal => Boolean(row))

  const printDevices = printRaw
    .map(row =>
      row && typeof row === 'object'
        ? normalizePrintDevice(row as Record<string, unknown>)
        : null
    )
    .filter((row): row is RestoPrintDevice => Boolean(row))

  return { lanTerminals, printDevices }
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
 * Server-only: whether a tenant id still appears in Nest admin tenants list.
 * Never import this into client components.
 */
export async function restoTenantExists(
  env: RestoAdminEnv,
  tenantId: string
): Promise<boolean> {
  const id = tenantId.trim()
  if (!id) return false
  const tenants = await fetchRestoTenants(env)
  return tenants.some(t => t.id === id)
}

/**
 * Server-only: hard-delete a Resto tenant via Nest DELETE /api/v1/admin/tenants/:id.
 * Body confirmTenantId must match the path id (Nest safety check).
 * Never import this into client components.
 *
 * Large tenants can outlive the HTTP wait — Nest may finish after we time out.
 * On timeout/504 we re-check the tenants list; if the id is gone, treat as success
 * so Ops does not retry a completed wipe. 404 is also treated as already deleted.
 */
export async function deleteRestoTenant(
  env: RestoAdminEnv,
  tenantId: string
): Promise<RestoTenantDeleteResult> {
  const id = tenantId.trim()
  if (!id) {
    throw new RestoAdminApiError('Missing tenant id', 400)
  }

  try {
    const { body } = await fetchAdminJson(
      env,
      `/api/v1/admin/tenants/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body: { confirmTenantId: id, confirm: true },
        // Full tenant wipe can take a while (api_hits, catalog, auth users)
        timeoutMs: 180_000,
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
  } catch (err) {
    if (err instanceof RestoAdminApiError && err.status === 404) {
      return {
        deleted: true,
        tenantId: id,
        tenantName: null,
        summary: null,
        confirmedAbsent: true,
      }
    }

    const timedOut =
      err instanceof RestoAdminApiError && err.status === 504

    if (timedOut) {
      try {
        const stillThere = await restoTenantExists(env, id)
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
        // Verification failed — fall through to original timeout error.
      }
    }

    throw err
  }
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return null
}

/** First defined Nest boolean across camelCase / snake_case aliases. */
function pickBoolean(
  raw: Record<string, unknown>,
  ...keys: string[]
): boolean | null {
  for (const key of keys) {
    const b = asBoolean(raw[key])
    if (b != null) return b
  }
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
    trialStartedAt:
      asTrimmedString(raw.trialStartedAt) ??
      asTrimmedString(raw.trial_started_at),
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
    // Prefer enterprise*Enabled (offer column). Short PUT-echo keys are fallback
    // only — Nest may also expose live/product flags under the same short names.
    enterpriseCallcenterEnabled: pickBoolean(
      raw,
      'enterpriseCallcenterEnabled',
      'enterprise_callcenter_enabled',
      'callCenter',
      'call_center'
    ),
    enterpriseKdsEnabled: pickBoolean(
      raw,
      'enterpriseKdsEnabled',
      'enterprise_kds_enabled',
      'kds'
    ),
    enterpriseInventoryEnabled: pickBoolean(
      raw,
      'enterpriseInventoryEnabled',
      'enterprise_inventory_enabled',
      'inventory'
    ),
    // Same pattern as inventory (enterprise* first, short key fallback).
    enterpriseSupplyChainEnabled: pickBoolean(
      raw,
      'enterpriseSupplyChainEnabled',
      'enterprise_supply_chain_enabled',
      'supplyChain',
      'supply_chain'
    ),
    // Nest: reservations (plural) — same short-key pattern as inventory.
    enterpriseReservationsEnabled: pickBoolean(
      raw,
      'enterpriseReservationsEnabled',
      'enterprise_reservations_enabled',
      'reservations'
    ),
    enterpriseChartOfAccountsEnabled: pickBoolean(
      raw,
      'enterpriseChartOfAccountsEnabled',
      'enterprise_chart_of_accounts_enabled',
      'chartOfAccounts',
      'chart_of_accounts'
    ),
    addonSupportEnabled: pickBoolean(
      raw,
      'addonSupportEnabled',
      'addon_support_enabled',
      'support'
    ),
    addonWebOrderingEnabled: pickBoolean(
      raw,
      'addonWebOrderingEnabled',
      'addon_web_ordering_enabled',
      'webOrdering',
      'web_ordering'
    ),
    enterprisePaidTrialEnabled:
      asBoolean(raw.enterprisePaidTrialEnabled) ??
      asBoolean(raw.enterprise_paid_trial_enabled),
    enterprisePaidTrialDurationDays:
      asNumber(raw.enterprisePaidTrialDurationDays) ??
      asNumber(raw.enterprise_paid_trial_duration_days),
    enterpriseInPaidTrial:
      asBoolean(raw.enterpriseInPaidTrial) ??
      asBoolean(raw.enterprise_in_paid_trial),
    enterprisePreTrialSetupFee:
      asNumber(raw.enterprisePreTrialSetupFee) ??
      asNumber(raw.enterprise_pre_trial_setup_fee),
    enterprisePostTrialSetupFee:
      asNumber(raw.enterprisePostTrialSetupFee) ??
      asNumber(raw.enterprise_post_trial_setup_fee),
    enterpriseAccessStartsAt:
      asTrimmedString(raw.enterpriseAccessStartsAt) ??
      asTrimmedString(raw.enterprise_access_starts_at),
    enterpriseTrialStartsAt:
      asTrimmedString(raw.enterpriseTrialStartsAt) ??
      asTrimmedString(raw.enterprise_trial_starts_at),
    prorateBackdatedAccess:
      asBoolean(raw.prorateBackdatedAccess) ??
      asBoolean(raw.enterprise_prorate_backdated_access) ??
      asBoolean(raw.prorate_backdated_access),
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
    // Live mirrors — prefer currentEnterprise*Enabled; short current* as fallback.
    currentEnterpriseCallcenterEnabled: pickBoolean(
      raw,
      'currentEnterpriseCallcenterEnabled',
      'current_enterprise_callcenter_enabled',
      'currentCallCenter',
      'current_call_center'
    ),
    currentEnterpriseKdsEnabled: pickBoolean(
      raw,
      'currentEnterpriseKdsEnabled',
      'current_enterprise_kds_enabled',
      'currentKds',
      'current_kds'
    ),
    currentEnterpriseInventoryEnabled: pickBoolean(
      raw,
      'currentEnterpriseInventoryEnabled',
      'current_enterprise_inventory_enabled',
      'currentInventory',
      'current_inventory'
    ),
    currentEnterpriseSupplyChainEnabled: pickBoolean(
      raw,
      'currentEnterpriseSupplyChainEnabled',
      'current_enterprise_supply_chain_enabled',
      'currentSupplyChain',
      'current_supply_chain'
    ),
    currentEnterpriseReservationsEnabled: pickBoolean(
      raw,
      'currentEnterpriseReservationsEnabled',
      'current_enterprise_reservations_enabled',
      'currentReservations',
      'current_reservations'
    ),
    currentEnterpriseChartOfAccountsEnabled: pickBoolean(
      raw,
      'currentEnterpriseChartOfAccountsEnabled',
      'current_enterprise_chart_of_accounts_enabled',
      'currentChartOfAccounts',
      'current_chart_of_accounts'
    ),
    currentEnterpriseSupportEnabled: pickBoolean(
      raw,
      'currentEnterpriseSupportEnabled',
      'current_enterprise_support_enabled',
      'currentSupport',
      'current_support'
    ),
    currentEnterpriseWebOrderingEnabled: pickBoolean(
      raw,
      'currentEnterpriseWebOrderingEnabled',
      'current_enterprise_web_ordering_enabled',
      'currentWebOrdering',
      'current_web_ordering'
    ),
    setupFeePaidUsd:
      asNumber(raw.setupFeePaidUsd) ??
      asNumber(raw.setup_fee_paid_usd),
    firstSubscriptionStartDate: asDateOnly(
      raw.firstSubscriptionStartDate ?? raw.first_subscription_start_date
    ),
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
      supplyChain: false,
      reservations: false,
      chartOfAccounts: false,
      webOrdering: false,
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
    locations: sub.enterpriseLocationsLimit,
    users: sub.enterpriseUsersLimit,
    counters: sub.enterpriseCountersLimit,
    ordersPerMonth: sub.enterpriseOrdersMonthLimit,
    callCenter: sub.enterpriseCallcenterEnabled,
    kds: sub.enterpriseKdsEnabled,
    inventory: sub.enterpriseInventoryEnabled,
    support: sub.addonSupportEnabled,
    supplyChain: sub.enterpriseSupplyChainEnabled,
    reservations: sub.enterpriseReservationsEnabled,
    chartOfAccounts: sub.enterpriseChartOfAccountsEnabled,
    webOrdering: sub.addonWebOrderingEnabled,
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

  // Nest DB enforces NOT NULL on pre/post trial setup fee columns.
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

function normalizeOrdersLock(
  raw: Record<string, unknown>,
  fallbackTenantId?: string
): RestoOrdersLockStatus | null {
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

/**
 * Server-only: GET indefinite order-placement lock status.
 * Never import into client components.
 */
export async function fetchRestoOrdersLock(
  env: RestoAdminEnv,
  tenantId: string
): Promise<RestoOrdersLockStatus> {
  const id = tenantId.trim()
  if (!id) throw new RestoAdminApiError('Missing tenant id', 400)

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/orders-lock`
  )

  if (!body || typeof body !== 'object') {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  const status = normalizeOrdersLock(body as Record<string, unknown>, id)
  if (!status) {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }
  return status
}

/**
 * Server-only: PUT indefinite order-placement lock.
 * Lock: `{ locked: true, reason?: string }`. Unlock: `{ locked: false }`.
 * Never import into client components.
 */
export async function putRestoOrdersLock(
  env: RestoAdminEnv,
  tenantId: string,
  input: { locked: boolean; reason?: string | null }
): Promise<RestoOrdersLockPutResult> {
  const id = tenantId.trim()
  if (!id) throw new RestoAdminApiError('Missing tenant id', 400)

  const payload: { locked: boolean; reason?: string } = {
    locked: input.locked === true,
  }
  if (payload.locked) {
    const reason = asTrimmedString(input.reason)
    if (reason) payload.reason = reason
  }

  const { body } = await fetchAdminJson(
    env,
    `/api/v1/admin/tenants/${encodeURIComponent(id)}/orders-lock`,
    {
      method: 'PUT',
      body: payload,
    }
  )

  if (!body || typeof body !== 'object') {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  const record = body as Record<string, unknown>
  const status = normalizeOrdersLock(record, id)
  if (!status) {
    throw new RestoAdminApiError('Resto admin API returned an unexpected payload', 502)
  }

  return {
    ...status,
    changed: record.changed === true || record.changed === 'true',
  }
}

/**
 * Server-only: DELETE pending Enterprise offer (clears enterprise_* only).
 * force=true when plan is already Enterprise or current_enterprise_price is set.
 */
export async function clearRestoEnterpriseOffer(
  env: RestoAdminEnv,
  tenantId: string,
  opts: { force?: boolean } = {}
): Promise<RestoEnterpriseClearResult> {
  const id = tenantId.trim()
  if (!id) throw new RestoAdminApiError('Missing tenant id', 400)

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
    cleared: record.cleared === true || record.cleared === 'true',
    tenant: normalizeSubTenant(tenantRaw),
    subscription: normalizeSubscription(subRaw),
    notes: asStringArray(record.notes),
  }
}
