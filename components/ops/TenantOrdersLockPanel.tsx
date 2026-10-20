'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type {
  RestoAdminEnv,
  RestoOrdersLockStatus,
  RestoTenant,
} from '@/lib/resto-admin/types'
import styles from './TenantDetailClient.module.css'

interface Props {
  tenant: RestoTenant
  env: RestoAdminEnv
  /** Called after a successful lock/unlock so the list badge can refresh. */
  onChanged?: () => void
  /** Ops User: view lock status only. */
  readOnly?: boolean
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; lock: RestoOrdersLockStatus }
  | { status: 'error'; message: string }

function formatLockedAt(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TenantOrdersLockPanel({
  tenant,
  env,
  onChanged,
  readOnly = false,
}: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [confirmingLock, setConfirmingLock] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    setActionError(null)
    try {
      const response = await fetch(
        `/api/ops/tenants/${encodeURIComponent(tenant.id)}/orders-lock?env=${encodeURIComponent(env)}`,
        { cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          status: 'error',
          message:
            typeof body.error === 'string'
              ? body.error
              : `Failed to load orders lock (${response.status})`,
        })
        return
      }
      setState({
        status: 'ready',
        lock: {
          tenantId:
            typeof body.tenantId === 'string' ? body.tenantId : tenant.id,
          tenantName:
            typeof body.tenantName === 'string' ? body.tenantName : null,
          subdomain:
            typeof body.subdomain === 'string' ? body.subdomain : null,
          locked: body.locked === true,
          lockedAt:
            typeof body.lockedAt === 'string' ? body.lockedAt : null,
          reason: typeof body.reason === 'string' ? body.reason : null,
        },
      })
    } catch {
      setState({
        status: 'error',
        message: 'Could not load orders lock. Check your connection and try again.',
      })
    }
  }, [env, tenant.id])

  useEffect(() => {
    void load()
  }, [load])

  const nameOk =
    confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase()
  const idOk = confirmId.trim() === tenant.id
  const canLock = confirmingLock && nameOk && idOk && !isPending

  function resetConfirm() {
    setConfirmingLock(false)
    setConfirmName('')
    setConfirmId('')
    setReason('')
  }

  function applyPut(locked: boolean) {
    setActionError(null)
    setActionOk(null)

    startTransition(async () => {
      try {
        const payload: { locked: boolean; reason?: string } = { locked }
        if (locked) {
          const trimmed = reason.trim()
          if (trimmed) payload.reason = trimmed
        }

        const response = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenant.id)}/orders-lock?env=${encodeURIComponent(env)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          setActionError(
            typeof body.error === 'string'
              ? body.error
              : `Update failed (${response.status})`
          )
          return
        }

        const next: RestoOrdersLockStatus = {
          tenantId:
            typeof body.tenantId === 'string' ? body.tenantId : tenant.id,
          tenantName:
            typeof body.tenantName === 'string' ? body.tenantName : null,
          subdomain:
            typeof body.subdomain === 'string' ? body.subdomain : null,
          locked: body.locked === true,
          lockedAt:
            typeof body.lockedAt === 'string' ? body.lockedAt : null,
          reason: typeof body.reason === 'string' ? body.reason : null,
        }
        setState({ status: 'ready', lock: next })
        resetConfirm()
        setActionOk(
          next.locked
            ? body.changed === false
              ? 'Orders were already locked.'
              : 'Orders placement locked.'
            : body.changed === false
              ? 'Orders were already unlocked.'
              : 'Orders placement unlocked.'
        )
        onChanged?.()
      } catch {
        setActionError(
          'Could not update orders lock. Check your connection and try again.'
        )
      }
    })
  }

  function handleLockSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canLock) return
    applyPut(true)
  }

  const locked =
    state.status === 'ready'
      ? state.lock.locked
      : tenant.ordersPlacementLocked === true

  return (
    <div className={`${styles.panel} ${locked ? styles.ordersLockPanelLocked : ''}`}>
      <div className={styles.ordersLockHeader}>
        <div>
          <h3 className={styles.panelTitle}>Order placement</h3>
          <p className={styles.panelBody}>
            Indefinite lock blocks new orders for this tenant until unlocked.
          </p>
        </div>
        {locked ? (
          <span className={styles.ordersLockedBadge}>Orders locked</span>
        ) : (
          <span className={styles.ordersUnlockedBadge}>Orders open</span>
        )}
      </div>

      {state.status === 'loading' && (
        <p className={styles.panelBody} style={{ marginTop: 12 }}>
          Loading lock status…
        </p>
      )}

      {state.status === 'error' && (
        <div className={styles.ordersLockMsgError} role="alert">
          {state.message}
          <button
            type="button"
            className={styles.secondaryBtn}
            style={{ marginLeft: 10 }}
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <dl className={styles.ordersLockMeta}>
            <div>
              <dt>Status</dt>
              <dd>{state.lock.locked ? 'Locked' : 'Unlocked'}</dd>
            </div>
            <div>
              <dt>Locked at</dt>
              <dd>{formatLockedAt(state.lock.lockedAt)}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>
                {state.lock.reason || (
                  <span className={styles.muted}>—</span>
                )}
              </dd>
            </div>
          </dl>

          {actionError && (
            <p className={styles.ordersLockMsgError} role="alert">
              {actionError}
            </p>
          )}
          {actionOk && (
            <p className={styles.ordersLockMsgOk} role="status">
              {actionOk}
            </p>
          )}

          {!readOnly && !state.lock.locked && !confirmingLock && (
            <div className={styles.ordersLockActions}>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={isPending}
                onClick={() => {
                  setActionOk(null)
                  setActionError(null)
                  setConfirmingLock(true)
                }}
              >
                Lock Orders
              </button>
            </div>
          )}

          {!readOnly && !state.lock.locked && confirmingLock && (
            <form className={styles.deleteForm} onSubmit={handleLockSubmit}>
              <p className={styles.panelBody}>
                Confirm lock for <strong>{tenant.name}</strong>{' '}
                (<span className={styles.mono}>{tenant.id}</span>). This
                immediately blocks new order placement.
              </p>
              <label className={styles.deleteField}>
                <span className={styles.fieldLabel}>Restaurant name</span>
                <input
                  className={styles.deleteInput}
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isPending}
                />
              </label>
              <label className={styles.deleteField}>
                <span className={styles.fieldLabel}>Tenant ID</span>
                <input
                  className={styles.deleteInput}
                  value={confirmId}
                  onChange={e => setConfirmId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isPending}
                />
              </label>
              <label className={styles.deleteField}>
                <span className={styles.fieldLabel}>
                  Reason <span className={styles.muted}>(optional, ops-only)</span>
                </span>
                <input
                  className={styles.deleteInput}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Non-payment"
                  autoComplete="off"
                  disabled={isPending}
                />
              </label>
              <div className={styles.deleteActions}>
                <button
                  type="submit"
                  className={styles.dangerBtn}
                  disabled={!canLock}
                >
                  {isPending ? 'Locking…' : 'Confirm lock'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={isPending}
                  onClick={resetConfirm}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!readOnly && state.lock.locked && (
            <div className={styles.ordersLockActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={isPending}
                onClick={() => applyPut(false)}
              >
                {isPending ? 'Unlocking…' : 'Unlock Orders'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
