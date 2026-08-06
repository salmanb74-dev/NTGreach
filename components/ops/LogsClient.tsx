'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RestoAdminEnv, RestoAuditLog } from '@/lib/resto-admin/types'
import styles from './LogsClient.module.css'

interface Props {
  initialEnv: RestoAdminEnv
  initialTenantId?: string
  initialActionType?: string
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      logs: RestoAuditLog[]
      nextCursor: string | null
    }
  | { status: 'error'; message: string; code?: string }

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMetadata(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta)
  if (!keys.length) return '—'
  try {
    return JSON.stringify(meta)
  } catch {
    return '—'
  }
}

export default function LogsClient({
  initialEnv,
  initialTenantId = '',
  initialActionType = '',
}: Props) {
  const [env, setEnv] = useState<RestoAdminEnv>(initialEnv)
  const [tenantId, setTenantId] = useState(initialTenantId)
  const [actionType, setActionType] = useState(initialActionType)
  const [appliedTenantId, setAppliedTenantId] = useState(initialTenantId)
  const [appliedActionType, setAppliedActionType] = useState(initialActionType)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [loadingMore, setLoadingMore] = useState(false)

  const syncUrl = useCallback(
    (nextEnv: RestoAdminEnv, nextTenantId: string, nextActionType: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('env', nextEnv)
      if (nextTenantId.trim()) url.searchParams.set('tenantId', nextTenantId.trim())
      else url.searchParams.delete('tenantId')
      if (nextActionType.trim()) {
        url.searchParams.set('actionType', nextActionType.trim())
      } else {
        url.searchParams.delete('actionType')
      }
      // Avoid RSC soft-navigation for filter/env query sync.
      window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`)
    },
    []
  )

  const load = useCallback(
    async (
      nextEnv: RestoAdminEnv,
      filters: { tenantId: string; actionType: string },
      cursor?: string | null
    ) => {
      const appending = Boolean(cursor)
      if (appending) setLoadingMore(true)
      else setState({ status: 'loading' })

      try {
        const params = new URLSearchParams()
        params.set('env', nextEnv)
        params.set('limit', '50')
        if (filters.tenantId.trim()) {
          params.set('tenantId', filters.tenantId.trim())
        }
        if (filters.actionType.trim()) {
          params.set('actionType', filters.actionType.trim())
        }
        if (cursor) params.set('cursor', cursor)

        const response = await fetch(`/api/ops/logs?${params.toString()}`, {
          cache: 'no-store',
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          setState({
            status: 'error',
            message: body.error ?? `Failed to load logs (${response.status})`,
            code: typeof body.code === 'string' ? body.code : undefined,
          })
          return
        }

        const pageLogs: RestoAuditLog[] = Array.isArray(body.logs) ? body.logs : []
        const nextCursor =
          typeof body.nextCursor === 'string' && body.nextCursor
            ? body.nextCursor
            : null

        setState(prev => {
          if (appending && prev.status === 'ready') {
            const seen = new Set(prev.logs.map(l => l.id))
            const merged = [
              ...prev.logs,
              ...pageLogs.filter(l => !seen.has(l.id)),
            ]
            return { status: 'ready', logs: merged, nextCursor }
          }
          return { status: 'ready', logs: pageLogs, nextCursor }
        })
      } catch {
        setState({
          status: 'error',
          message: 'Could not load logs. Check your connection and try again.',
        })
      } finally {
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    void load(env, {
      tenantId: appliedTenantId,
      actionType: appliedActionType,
    })
  }, [env, appliedTenantId, appliedActionType, load])

  function selectEnv(next: RestoAdminEnv) {
    if (next === env) return
    setEnv(next)
    syncUrl(next, appliedTenantId, appliedActionType)
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    setAppliedTenantId(tenantId)
    setAppliedActionType(actionType)
    syncUrl(env, tenantId, actionType)
  }

  function clearFilters() {
    setTenantId('')
    setActionType('')
    setAppliedTenantId('')
    setAppliedActionType('')
    syncUrl(env, '', '')
  }

  const isProduction = env === 'production'
  const hasFilters = Boolean(appliedTenantId.trim() || appliedActionType.trim())

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Audit logs</h2>
          <p className={styles.sub}>
            Significant Resto actions from Nest audit_logs (newest first). Coverage
            grows as more actions are audited.
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
        </div>
      </div>

      <form className={styles.filters} onSubmit={applyFilters}>
        <input
          className={styles.filterInput}
          type="text"
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          placeholder="Tenant ID"
          aria-label="Filter by tenant ID"
          spellCheck={false}
        />
        <input
          className={styles.filterInput}
          type="text"
          value={actionType}
          onChange={e => setActionType(e.target.value)}
          placeholder="Action type (e.g. orders.delete_all)"
          aria-label="Filter by action type"
          spellCheck={false}
        />
        <button type="submit" className={styles.filterBtn}>
          Apply
        </button>
        {hasFilters && (
          <button
            type="button"
            className={styles.filterBtnSecondary}
            onClick={clearFilters}
          >
            Clear
          </button>
        )}
      </form>

      <div className={styles.metaRow}>
        <span>
          Showing{' '}
          <span className={styles.metaStrong}>
            {state.status === 'ready' ? state.logs.length : '—'}
          </span>{' '}
          log{state.status === 'ready' && state.logs.length === 1 ? '' : 's'} in{' '}
          <span className={styles.metaStrong}>
            {isProduction ? 'Production' : 'Staging'}
          </span>
        </span>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loadingBox} role="status">
          Loading logs from Resto…
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.errorBox} role="alert">
          <p className={styles.errorTitle}>
            {state.code === 'not_configured'
              ? 'Resto admin API not configured'
              : 'Could not load logs'}
          </p>
          <p className={styles.errorBody}>{state.message}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() =>
              void load(env, {
                tenantId: appliedTenantId,
                actionType: appliedActionType,
              })
            }
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && state.logs.length === 0 && (
        <div className={styles.empty}>
          {hasFilters ? (
            'No logs match these filters.'
          ) : (
            <>
              No audit logs yet for this environment.
              <br />
              Resto currently writes logs for a few actions only (e.g.{' '}
              <code className={styles.action}>orders.delete_all</code>
              ). Run one of those in Staging, then refresh.
            </>
          )}
        </div>
      )}

      {state.status === 'ready' && state.logs.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Tenant</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.map(log => (
                  <tr key={log.id}>
                    <td className={styles.when}>{formatWhen(log.createdAt)}</td>
                    <td>
                      <div className={styles.tenantName}>
                        {log.tenantName || '—'}
                      </div>
                      <div className={styles.mono}>{log.tenantId}</div>
                    </td>
                    <td>
                      <code className={styles.action}>{log.actionType}</code>
                    </td>
                    <td>
                      {log.userName || log.userEmail ? (
                        <>
                          <div>{log.userName || '—'}</div>
                          {log.userEmail && (
                            <div className={styles.muted}>{log.userEmail}</div>
                          )}
                        </>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td className={styles.metaCell}>
                      <code className={styles.metaCode}>
                        {formatMetadata(log.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.nextCursor && (
            <div className={styles.loadMoreRow}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                disabled={loadingMore}
                onClick={() =>
                  void load(
                    env,
                    {
                      tenantId: appliedTenantId,
                      actionType: appliedActionType,
                    },
                    state.nextCursor
                  )
                }
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
