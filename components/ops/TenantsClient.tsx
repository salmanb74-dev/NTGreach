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

export default function TenantsClient({ initialEnv }: Props) {
  const router = useRouter()
  const [env, setEnv] = useState<RestoAdminEnv>(initialEnv)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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
          message: body.error ?? `Failed to load tenants (${response.status})`,
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
    const url = new URL(window.location.href)
    url.searchParams.set('env', next)
    router.replace(`${url.pathname}?${url.searchParams.toString()}`)
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
              </tr>
            </thead>
            <tbody>
              {filtered.map(tenant => (
                <tr
                  key={tenant.id}
                  className={styles.rowLink}
                  onClick={() =>
                    router.push(
                      `/ops/management/${encodeURIComponent(tenant.id)}?env=${env}`
                    )
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(
                        `/ops/management/${encodeURIComponent(tenant.id)}?env=${env}`
                      )
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
