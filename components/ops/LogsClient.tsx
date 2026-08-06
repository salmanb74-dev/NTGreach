'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import type { RestoAdminEnv, RestoApiHit } from '@/lib/resto-admin/types'
import { metaNumber, metaString } from '@/lib/resto-admin/types'
import styles from './LogsClient.module.css'

interface Props {
  initialEnv: RestoAdminEnv
  initialTenantId?: string
  initialActionType?: string
  /** When set, tenant filter is fixed (tenant detail Logs tab). */
  lockTenantId?: boolean
  /** Compact chrome for embedding (no env toggle, lighter title). */
  embed?: boolean
}

type Filters = {
  tenantId: string
  actionType: string
  method: string
  statusCode: string
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      logs: RestoApiHit[]
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
    second: '2-digit',
  })
}

function summarizeHit(log: RestoApiHit) {
  const method =
    metaString(log.metadata, 'method') ||
    log.actionType.split(/\s+/)[0] ||
    '—'
  const status = metaNumber(log.metadata, 'statusCode')
  const ms = metaNumber(log.metadata, 'responseTimeMs')
  const url = metaString(log.metadata, 'url')
  return { method, status, ms, url }
}

function formatBodies(log: RestoApiHit): string {
  const parts: string[] = []
  const req = log.metadata.requestBody
  const res = log.metadata.responseBody
  if (req !== undefined) {
    try {
      parts.push(
        `req: ${typeof req === 'string' ? req : JSON.stringify(req)}`
      )
    } catch {
      parts.push('req: […]')
    }
  }
  if (res !== undefined) {
    try {
      parts.push(
        `res: ${typeof res === 'string' ? res : JSON.stringify(res)}`
      )
    } catch {
      parts.push('res: […]')
    }
  }
  return parts.length ? parts.join('\n') : '—'
}

export default function LogsClient({
  initialEnv,
  initialTenantId = '',
  initialActionType = '',
  lockTenantId = false,
  embed = false,
}: Props) {
  const [env, setEnv] = useState<RestoAdminEnv>(initialEnv)
  const [tenantId, setTenantId] = useState(initialTenantId)
  const [actionType, setActionType] = useState(initialActionType)
  const [method, setMethod] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [applied, setApplied] = useState<Filters>({
    tenantId: initialTenantId,
    actionType: initialActionType,
    method: '',
    statusCode: '',
  })
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setEnv(initialEnv)
  }, [initialEnv])

  useEffect(() => {
    if (lockTenantId || initialTenantId) {
      setTenantId(initialTenantId)
      setApplied(prev => ({ ...prev, tenantId: initialTenantId }))
    }
  }, [initialTenantId, lockTenantId])

  const syncUrl = useCallback(
    (nextEnv: RestoAdminEnv, next: Filters) => {
      if (embed) return
      const url = new URL(window.location.href)
      url.searchParams.set('env', nextEnv)
      if (next.tenantId.trim()) {
        url.searchParams.set('tenantId', next.tenantId.trim())
      } else {
        url.searchParams.delete('tenantId')
      }
      if (next.actionType.trim()) {
        url.searchParams.set('actionType', next.actionType.trim())
      } else {
        url.searchParams.delete('actionType')
      }
      if (next.method.trim()) {
        url.searchParams.set('method', next.method.trim())
      } else {
        url.searchParams.delete('method')
      }
      if (next.statusCode.trim()) {
        url.searchParams.set('statusCode', next.statusCode.trim())
      } else {
        url.searchParams.delete('statusCode')
      }
      window.history.replaceState(
        null,
        '',
        `${url.pathname}?${url.searchParams.toString()}`
      )
    },
    [embed]
  )

  const load = useCallback(
    async (
      nextEnv: RestoAdminEnv,
      filters: Filters,
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
        if (filters.method.trim()) {
          params.set('method', filters.method.trim())
        }
        if (filters.statusCode.trim()) {
          params.set('statusCode', filters.statusCode.trim())
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

        const pageLogs: RestoApiHit[] = Array.isArray(body.logs) ? body.logs : []
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
    void load(env, applied)
  }, [env, applied, load])

  function selectEnv(next: RestoAdminEnv) {
    if (next === env) return
    setEnv(next)
    syncUrl(next, applied)
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    const next: Filters = {
      tenantId: lockTenantId ? initialTenantId : tenantId,
      actionType,
      method,
      statusCode,
    }
    setApplied(next)
    syncUrl(env, next)
  }

  function clearFilters() {
    const next: Filters = {
      tenantId: lockTenantId ? initialTenantId : '',
      actionType: '',
      method: '',
      statusCode: '',
    }
    if (!lockTenantId) setTenantId('')
    setActionType('')
    setMethod('')
    setStatusCode('')
    setApplied(next)
    syncUrl(env, next)
  }

  const isProduction = env === 'production'
  const hasFilters = Boolean(
    (!lockTenantId && applied.tenantId.trim()) ||
      applied.actionType.trim() ||
      applied.method.trim() ||
      applied.statusCode.trim()
  )

  return (
    <div className={embed ? styles.embed : styles.page}>
      {!embed && (
        <div className={styles.topBar}>
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>API hits</h2>
            <p className={styles.sub}>
              Recent Nest HTTP traffic from <code className={styles.inlineCode}>api_hits</code>{' '}
              (~24h retention). Empty usually means no recent traffic on this
              environment.
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
      )}

      {embed && (
        <p className={styles.embedHint}>
          Nest HTTP hits for this tenant (~24h). Empty = no recent traffic.
        </p>
      )}

      <form className={styles.filters} onSubmit={applyFilters}>
        {!lockTenantId && (
          <input
            className={styles.filterInput}
            type="text"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            placeholder="Tenant ID"
            aria-label="Filter by tenant ID"
            spellCheck={false}
          />
        )}
        <input
          className={styles.filterInput}
          type="text"
          value={actionType}
          onChange={e => setActionType(e.target.value)}
          placeholder="Path / action (e.g. orders)"
          aria-label="Filter by method or URL substring"
          spellCheck={false}
        />
        <input
          className={styles.filterInputNarrow}
          type="text"
          value={method}
          onChange={e => setMethod(e.target.value)}
          placeholder="Method"
          aria-label="Filter by HTTP method"
          spellCheck={false}
        />
        <input
          className={styles.filterInputNarrow}
          type="text"
          value={statusCode}
          onChange={e => setStatusCode(e.target.value)}
          placeholder="Status"
          aria-label="Filter by status code"
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
          hit{state.status === 'ready' && state.logs.length === 1 ? '' : 's'}
          {!embed && (
            <>
              {' '}
              in{' '}
              <span className={styles.metaStrong}>
                {isProduction ? 'Production' : 'Staging'}
              </span>
            </>
          )}
        </span>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loadingBox} role="status">
          Loading API hits from Resto…
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
            onClick={() => void load(env, applied)}
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && state.logs.length === 0 && (
        <div className={styles.empty}>
          {hasFilters
            ? 'No hits match these filters.'
            : 'No API hits in the retention window (~24h) for this environment.'}
        </div>
      )}

      {state.status === 'ready' && state.logs.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  {!lockTenantId && <th>Tenant</th>}
                  <th>Method</th>
                  <th>Status</th>
                  <th>ms</th>
                  <th>Action / path</th>
                  <th>User</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.logs.map(log => {
                  const hit = summarizeHit(log)
                  const open = expandedId === log.id
                  return (
                    <Fragment key={log.id}>
                      <tr>
                        <td className={styles.when}>{formatWhen(log.createdAt)}</td>
                        {!lockTenantId && (
                          <td>
                            <div className={styles.tenantName}>
                              {log.tenantName || '—'}
                            </div>
                            {log.tenantId && (
                              <div className={styles.mono}>{log.tenantId}</div>
                            )}
                          </td>
                        )}
                        <td>
                          <code className={styles.action}>{hit.method}</code>
                        </td>
                        <td>
                          {hit.status != null ? (
                            <span
                              className={
                                hit.status >= 400
                                  ? styles.statusBad
                                  : styles.statusOk
                              }
                            >
                              {hit.status}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td className={styles.muted}>
                          {hit.ms != null ? hit.ms : '—'}
                        </td>
                        <td>
                          <code className={styles.action}>{log.actionType}</code>
                          {hit.url && hit.url !== log.actionType && (
                            <div className={styles.mono}>{hit.url}</div>
                          )}
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
                        <td className={styles.actionsCell}>
                          <button
                            type="button"
                            className={styles.filterBtnSecondary}
                            onClick={() =>
                              setExpandedId(open ? null : log.id)
                            }
                          >
                            {open ? 'Hide' : 'Body'}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className={styles.detailRow}>
                          <td colSpan={lockTenantId ? 7 : 8}>
                            <pre className={styles.metaCode}>
                              {formatBodies(log)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {state.nextCursor && (
            <div className={styles.loadMoreRow}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                disabled={loadingMore}
                onClick={() => void load(env, applied, state.nextCursor)}
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
