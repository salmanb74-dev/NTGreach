'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RestoAdminEnv, RestoTenant } from '@/lib/resto-admin/types'
import styles from './TenantsClient.module.css'

interface Props {
  initialEnv: RestoAdminEnv
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tenants: RestoTenant[] }
  | { status: 'error'; message: string; code?: string }

const COPY_FIELDS: { label: string; value: (t: RestoTenant) => string }[] = [
  { label: 'Restaurant', value: t => t.name || '—' },
  { label: 'Owner', value: t => t.ownerName || '—' },
  { label: 'Owner email', value: t => t.ownerEmail || '—' },
  { label: 'Tenant ID', value: t => t.id || '—' },
]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTenantClipboard(tenant: RestoTenant): { plain: string; html: string } {
  const rows = COPY_FIELDS.map(({ label, value }) => ({
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

async function copyTenantDetails(tenant: RestoTenant): Promise<void> {
  const { plain, html } = buildTenantClipboard(tenant)

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

export default function TenantsClient({ initialEnv }: Props) {
  const router = useRouter()
  const [env, setEnv] = useState<RestoAdminEnv>(initialEnv)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async (nextEnv: RestoAdminEnv) => {
    setState({ status: 'loading' })
    try {
      const response = await fetch(
        `/api/ops/tenants?env=${encodeURIComponent(nextEnv)}`,
        { cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          status: 'error',
          message:
            body.error ??
            (response.status === 404
              ? 'Reach API route /api/ops/tenants not found (404). Restart the Reach dev server after clearing .next.'
              : `Failed to load tenants (${response.status})`),
          code: typeof body.code === 'string' ? body.code : undefined,
        })
        return
      }
      setState({
        status: 'ready',
        tenants: Array.isArray(body.tenants) ? body.tenants : [],
      })
    } catch {
      setState({
        status: 'error',
        message: 'Could not load tenants. Check your connection and try again.',
      })
    }
  }, [])

  useEffect(() => {
    void load(env)
  }, [env, load])

  function selectEnv(next: RestoAdminEnv) {
    if (next === env) return
    setEnv(next)
    setQuery('')
    // Sync query string without an RSC soft-navigation (avoids flaky
    // "Failed to fetch RSC payload" when the dev server is compiling/busy).
    const url = new URL(window.location.href)
    url.searchParams.set('env', next)
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`)
  }

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    if (!q) return state.tenants
    return state.tenants.filter(t => {
      const haystack = [
        t.name,
        t.ownerName ?? '',
        t.ownerEmail ?? '',
        t.id,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [state, query])

  async function handleCopy(
    e: React.MouseEvent,
    tenant: RestoTenant
  ) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await copyTenantDetails(tenant)
      setCopiedId(tenant.id)
      window.setTimeout(() => {
        setCopiedId(prev => (prev === tenant.id ? null : prev))
      }, 1500)
    } catch {
      // Clipboard may be blocked; leave UI as-is
    }
  }

  function openTenant(tenantId: string) {
    router.push(`/ops/management/${encodeURIComponent(tenantId)}?env=${env}`)
  }

  const isProduction = env === 'production'

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Resto tenants</h2>
          <p className={styles.sub}>
            Internal ops view of restaurants in the selected Resto environment.
            Keys stay on the Reach server — never in the browser.
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
          {state.status === 'ready' && query.trim()
            ? ` of ${state.tenants.length}`
            : ''}{' '}
          tenants in{' '}
          <span className={styles.metaStrong}>
            {isProduction ? 'Production' : 'Staging'}
          </span>
        </span>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loadingBox} role="status">
          Loading tenants from Resto…
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.errorBox} role="alert">
          <p className={styles.errorTitle}>
            {state.code === 'not_configured'
              ? 'Resto admin API not configured'
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
          {query.trim()
            ? 'No tenants match your search.'
            : 'No tenants returned for this environment.'}
        </div>
      )}

      {state.status === 'ready' && filtered.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Owner</th>
                <th>Owner email</th>
                <th>Tenant ID</th>
                <th className={styles.actionsCol}>
                  <span className={styles.srOnly}>Copy</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tenant => (
                <tr
                  key={tenant.id}
                  className={`${styles.rowLink} ${
                    copiedId === tenant.id ? styles.rowCopied : ''
                  }`}
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
                  <td className={styles.tenantName}>{tenant.name}</td>
                  <td>
                    {tenant.ownerName || (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {tenant.ownerEmail || (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.mono}>{tenant.id}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
