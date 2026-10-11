'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type {
  AlmaAdminEnv,
  AlmaPlanFilter,
  AlmaTenant,
} from '@/lib/alma-admin/types'
import {
  almaBillingCycleLabel,
  almaPlanBucket,
  almaPlanLabel,
  almaUsageLabel,
} from '@/lib/alma-admin/types'
import type {
  RestoAdminEnv,
  RestoPlanFilter,
  RestoTenant,
} from '@/lib/resto-admin/types'
import {
  restoBillingCycleLabel,
  restoPlanBucket,
  restoPlanLabel,
  restoUsageLabel,
} from '@/lib/resto-admin/types'
import {
  opsApiBasePath,
  opsProductFromModule,
  type OpsNestProduct,
} from '@/lib/ops/product'
import {
  listCashTenantSummaries,
  type CashTenantSummary,
} from '@/lib/actions/ops-cash'
import { formatDueLabel } from '@/lib/ops/cash-collection'
import { moduleFromPathname, modulePath } from '@/lib/module-routing'
import type { Module } from '@/lib/modules'
import styles from './TenantsClient.module.css'

type OpsAdminEnv = RestoAdminEnv | AlmaAdminEnv

interface Props {
  initialEnv: OpsAdminEnv
}

type TenantRow = RestoTenant | AlmaTenant

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tenants: TenantRow[] }
  | { status: 'error'; message: string; code?: string }

type CashFilter = 'all' | 'cash' | 'due_week'

type PlanFilter = RestoPlanFilter | AlmaPlanFilter

function copyFields(product: OpsNestProduct): {
  label: string
  value: (t: TenantRow) => string
}[] {
  if (product === 'alma') {
    return [
      { label: 'School', value: t => t.name || '—' },
      { label: 'Owner', value: t => t.ownerName || '—' },
      { label: 'Owner email', value: t => t.ownerEmail || '—' },
      { label: 'Plan', value: t => almaPlanLabel(t as AlmaTenant) },
      { label: 'Trial', value: t => t.trialStartedAt || '—' },
      {
        label: 'First',
        value: t => t.firstSubscriptionStartDate || '',
      },
      { label: 'Current', value: t => t.subscriptionStart || '—' },
      {
        label: 'Billing cycle',
        value: t => almaBillingCycleLabel(t as AlmaTenant) || '—',
      },
      {
        label: 'Usage',
        value: t => almaUsageLabel(t as AlmaTenant) || '—',
      },
      {
        label: 'Assessments lock',
        value: t =>
          (t as AlmaTenant).assessmentsCreationLocked ? 'Locked' : 'Open',
      },
      { label: 'Tenant ID', value: t => t.id || '—' },
    ]
  }
  return [
    { label: 'Restaurant', value: t => t.name || '—' },
    { label: 'Owner', value: t => t.ownerName || '—' },
    { label: 'Owner email', value: t => t.ownerEmail || '—' },
    { label: 'Plan', value: t => restoPlanLabel(t as RestoTenant) },
    { label: 'Trial', value: t => t.trialStartedAt || '—' },
    {
      label: 'First',
      value: t => t.firstSubscriptionStartDate || '',
    },
    { label: 'Current', value: t => t.subscriptionStart || '—' },
    {
      label: 'Billing cycle',
      value: t => restoBillingCycleLabel(t as RestoTenant) || '—',
    },
    {
      label: 'Usage',
      value: t => restoUsageLabel(t as RestoTenant) || '—',
    },
    {
      label: 'Last order',
      value: t => (t as RestoTenant).lastOrderAt || '—',
    },
    {
      label: 'Orders lock',
      value: t =>
        (t as RestoTenant).ordersPlacementLocked ? 'Locked' : 'Open',
    },
    { label: 'Tenant ID', value: t => t.id || '—' },
  ]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTenantClipboard(
  tenant: TenantRow,
  product: OpsNestProduct
): { plain: string; html: string } {
  const rows = copyFields(product).map(({ label, value }) => ({
    label,
    value: value(tenant),
  }))

  const plain = rows.map(r => `${r.label}: ${r.value}`).join('\n')
  const html = rows
    .map(
      r =>
        `<div><strong>${escapeHtml(r.label)}</strong> ${escapeHtml(r.value)}</div>`
    )
    .join('')

  return { plain, html }
}

async function copyTenantDetails(
  tenant: TenantRow,
  product: OpsNestProduct
): Promise<void> {
  const { plain, html } = buildTenantClipboard(tenant, product)

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
      return
    } catch {
      // fall through to plain text
    }
  }

  await navigator.clipboard.writeText(plain)
}

/** Compact cash due for narrow tables. */
function formatCashDueShort(cash: CashTenantSummary): string {
  const label = formatDueLabel(cash.due)
  const kind =
    cash.due.nextKind === 'setup'
      ? 'S'
      : cash.due.nextKind === 'setup_pre_trial'
        ? 'PT'
        : cash.due.nextKind === 'recurring'
          ? 'R'
          : cash.due.nextKind === 'other'
            ? 'O'
            : ''
  const partial =
    cash.due.nextKind &&
    cash.due.nextAmountCollected != null &&
    cash.due.nextAmountCollected > 0
      ? ' · partial'
      : ''
  return kind ? `${label} · ${kind}${partial}` : label
}

export default function TenantsClient({ initialEnv }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const productModule: Module =
    moduleFromPathname(pathname)?.startsWith('ops_')
      ? (moduleFromPathname(pathname) as Module)
      : 'ops_resto'
  const product: OpsNestProduct =
    opsProductFromModule(productModule) ?? 'resto'
  const apiBase = opsApiBasePath(product)
  const isAlma = product === 'alma'
  const [env, setEnv] = useState<OpsAdminEnv>(initialEnv)
  const [query, setQuery] = useState('')
  const [cashFilter, setCashFilter] = useState<CashFilter>('all')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [cashByTenant, setCashByTenant] = useState<
    Record<string, CashTenantSummary>
  >({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadCash = useCallback(async () => {
    try {
      const rows = await listCashTenantSummaries(product)
      const map: Record<string, CashTenantSummary> = {}
      for (const row of rows) map[row.tenantId] = row
      setCashByTenant(map)
    } catch {
      setCashByTenant({})
    }
  }, [product])

  const load = useCallback(async (nextEnv: OpsAdminEnv) => {
    setState({ status: 'loading' })
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch(
        `${apiBase}/tenants?env=${encodeURIComponent(nextEnv)}`,
        { cache: 'no-store', signal: controller.signal }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          status: 'error',
          message:
            body.error ??
            (response.status === 404
              ? `Reach API route ${apiBase}/tenants not found (404). Restart the Reach dev server after clearing .next.`
              : `Failed to load tenants (${response.status})`),
          code: typeof body.code === 'string' ? body.code : undefined,
        })
        return
      }
      setState({
        status: 'ready',
        tenants: Array.isArray(body.tenants) ? body.tenants : [],
      })
      if (nextEnv === 'production') {
        void loadCash()
      } else {
        setCashByTenant({})
      }
    } catch (err) {
      const timedOut =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError')
      setState({
        status: 'error',
        message: timedOut
          ? `Request timed out after 20s. Reach may be hung — restart \`npm run dev -- -p 3002\`, or Nest is slow at ${isAlma ? 'ALMA' : 'RESTO'}_*_BASE_URL.`
          : 'Could not load tenants. Check your connection and try again.',
      })
    } finally {
      window.clearTimeout(timer)
    }
  }, [apiBase, isAlma, loadCash])

  useEffect(() => {
    void load(env)
  }, [env, load])

  function selectEnv(next: OpsAdminEnv) {
    if (next === env) return
    setEnv(next)
    setQuery('')
    setCashFilter('all')
    setPlanFilter('all')
    const url = new URL(window.location.href)
    url.searchParams.set('env', next)
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`)
  }

  const hasActiveFilters =
    !!query.trim() ||
    cashFilter !== 'all' ||
    planFilter !== 'all'

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    return state.tenants.filter(t => {
      if (q) {
        const haystack = [
          t.name,
          t.ownerName ?? '',
          t.ownerEmail ?? '',
          t.id,
          isAlma ? almaPlanLabel(t as AlmaTenant) : restoPlanLabel(t as RestoTenant),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (planFilter !== 'all') {
        const bucket = isAlma
          ? almaPlanBucket(t as AlmaTenant)
          : restoPlanBucket(t as RestoTenant)
        if (bucket !== planFilter) return false
      }
      if (env !== 'production' || cashFilter === 'all') return true
      const cash = cashByTenant[t.id]
      if (cashFilter === 'cash') return !!cash
      if (cashFilter === 'due_week') return !!cash && cash.due.dueSoon
      return true
    })
  }, [state, query, env, cashFilter, planFilter, cashByTenant, isAlma])

  async function handleCopy(
    e: React.MouseEvent,
    tenant: TenantRow
  ) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await copyTenantDetails(tenant, product)
      setCopiedId(tenant.id)
      window.setTimeout(() => {
        setCopiedId(prev => (prev === tenant.id ? null : prev))
      }, 1500)
    } catch {
      // Clipboard may be blocked; leave UI as-is
    }
  }

  function openTenant(tenantId: string) {
    router.push(
      `${modulePath(productModule, 'management', tenantId)}?env=${env}`
    )
  }

  const isProduction = env === 'production'

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>
            {isAlma ? 'Alma tenants' : 'Resto tenants'}
          </h2>
          <p className={styles.sub}>
            Internal ops view of {isAlma ? 'schools' : 'restaurants'} in the
            selected {isAlma ? 'Alma' : 'Resto'} environment. Keys stay on the
            Reach server — never in the browser.
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.envToggle} role="group" aria-label="Environment">
            <button
              type="button"
              className={`${styles.envBtn} ${
                env === 'staging' ? styles.envBtnActiveStaging : ''
              }`}
              onClick={() => selectEnv('staging')}
            >
              Staging
            </button>
            <button
              type="button"
              className={`${styles.envBtn} ${
                env === 'production' ? styles.envBtnActiveProduction : ''
              }`}
              onClick={() => selectEnv('production')}
            >
              Production
            </button>
          </div>

          <span
            className={`${styles.envBadge} ${
              isProduction ? styles.envBadgeProduction : styles.envBadgeStaging
            }`}
          >
            {isProduction ? 'Production' : 'Staging'}
          </span>

          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search tenants"
          />
        </div>
      </div>

      <div className={styles.metaRow}>
        <span>
          Showing{' '}
          <span className={styles.metaStrong}>
            {state.status === 'ready' ? filtered.length : '—'}
          </span>
          {state.status === 'ready' && hasActiveFilters
            ? ` of ${state.tenants.length}`
            : ''}{' '}
          tenants in{' '}
          <span className={styles.metaStrong}>
            {isProduction ? 'Production' : 'Staging'}
          </span>
        </span>

        <div className={styles.filterGroups}>
          {isProduction && (
            <div className={styles.filterToggle} role="group" aria-label="Cash filter">
              {(
                [
                  ['all', 'All'],
                  ['cash', 'Cash'],
                  ['due_week', 'Due ≤7d'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.filterBtn} ${
                    cashFilter === id ? styles.filterBtnActive : ''
                  }`}
                  onClick={() => setCashFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.filterToggle} role="group" aria-label="Plan filter">
            {(
              [
                ['all', 'All'],
                ['free', 'Free'],
                ['trial', 'Trial'],
                ['pro', 'Pro'],
                ['ent', 'Ent'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`${styles.filterBtn} ${
                  planFilter === id ? styles.filterBtnActive : ''
                }`}
                onClick={() => setPlanFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loadingBox} role="status">
          Loading tenants from {isAlma ? 'Alma' : 'Resto'}…
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.errorBox} role="alert">
          <p className={styles.errorTitle}>
            {state.code === 'not_configured'
              ? `${isAlma ? 'Alma' : 'Resto'} admin API not configured`
              : 'Could not load tenants'}
          </p>
          <p className={styles.errorBody}>{state.message}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => void load(env)}
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && filtered.length === 0 && (
        <div className={styles.empty}>
          {hasActiveFilters
            ? 'No tenants match your filters.'
            : 'No tenants returned for this environment.'}
        </div>
      )}

      {state.status === 'ready' && filtered.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.lockCol}>
                  <span className={styles.srOnly}>
                    {isAlma ? 'Assessments lock' : 'Orders lock'}
                    {isProduction ? ' / cash collection' : ''}
                  </span>
                </th>
                <th>{isAlma ? 'School' : 'Restaurant'}</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Plan</th>
                <th title="Trial start">Trial</th>
                <th title="First subscription start">First</th>
                <th title="Current subscription start">Current</th>
                <th>Billing cycle</th>
                <th>Usage</th>
                {!isAlma && <th>Last order</th>}
                {isProduction && <th>Cash due</th>}
                <th className={styles.actionsCol}>
                  <span className={styles.srOnly}>Actions</span>
                </th>
                <th>Tenant ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tenant => {
                const cash = cashByTenant[tenant.id]
                const dueSoon = isProduction && cash?.due.dueSoon === true
                return (
                  <tr
                    key={tenant.id}
                    className={`${styles.rowLink} ${
                      copiedId === tenant.id ? styles.rowCopied : ''
                    } ${dueSoon ? styles.rowDueSoon : ''}`}
                    onClick={() => openTenant(tenant.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openTenant(tenant.id)
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${tenant.name}`}
                  >
                    <td className={styles.lockCell}>
                      <span className={styles.statusIcons}>
                        {(isAlma
                          ? (tenant as AlmaTenant).assessmentsCreationLocked
                          : (tenant as RestoTenant)
                              .ordersPlacementLocked) && (
                          <span
                            className={styles.lockIcon}
                            title={
                              isAlma ? 'Assessments locked' : 'Orders locked'
                            }
                            aria-label={
                              isAlma ? 'Assessments locked' : 'Orders locked'
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <rect
                                x="5"
                                y="11"
                                width="14"
                                height="10"
                                rx="2"
                              />
                              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                            </svg>
                          </span>
                        )}
                        {isProduction && cash && (
                          <span
                            className={`${styles.cashIcon} ${
                              dueSoon ? styles.cashIconDue : ''
                            }`}
                            title={
                              dueSoon
                                ? `Cash collection · due soon ${formatCashDueShort(cash)}`
                                : `Cash collection · ${formatCashDueShort(cash)}`
                            }
                            aria-label={
                              dueSoon
                                ? 'Cash collection tenant, due soon'
                                : 'Cash collection tenant'
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <rect
                                x="2"
                                y="6"
                                width="20"
                                height="12"
                                rx="2"
                              />
                              <circle cx="12" cy="12" r="2.5" />
                              <path d="M6 12h0.01M18 12h0.01" />
                            </svg>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={styles.tenantName}>{tenant.name}</td>
                    <td>
                      {tenant.ownerName || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.emailCell}>
                      {tenant.ownerEmail || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td>
                      {isAlma
                        ? almaPlanLabel(tenant as AlmaTenant)
                        : restoPlanLabel(tenant as RestoTenant)}
                    </td>
                    <td className={styles.dateCell}>
                      {tenant.trialStartedAt || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.dateCell}>
                      {tenant.firstSubscriptionStartDate || ''}
                    </td>
                    <td className={styles.dateCell}>
                      {tenant.subscriptionStart || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.dateCell}>
                      {(isAlma
                        ? almaBillingCycleLabel(tenant as AlmaTenant)
                        : restoBillingCycleLabel(tenant as RestoTenant)) || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.usageCell}>
                      {(isAlma
                        ? almaUsageLabel(tenant as AlmaTenant)
                        : restoUsageLabel(tenant as RestoTenant)) || (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    {!isAlma && (
                      <td className={styles.dateCell}>
                        {(tenant as RestoTenant).lastOrderAt || (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    )}
                    {isProduction && (
                      <td className={styles.cashCell}>
                        {cash ? (
                          <span
                            className={
                              dueSoon ? styles.dueAlert : styles.dueOk
                            }
                          >
                            {formatCashDueShort(cash)}
                          </span>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    )}
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={e => void handleCopy(e, tenant)}
                        aria-label={
                          copiedId === tenant.id
                            ? `Copied details for ${tenant.name}`
                            : `Copy details for ${tenant.name}`
                        }
                        title={
                          copiedId === tenant.id
                            ? 'Copied'
                            : 'Copy tenant details'
                        }
                      >
                        Copy
                      </button>
                    </td>
                    <td className={styles.mono}>{tenant.id}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
