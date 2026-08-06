'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type {
  RestoAdminEnv,
  RestoTenant,
  RestoTenantDeleteSummary,
} from '@/lib/resto-admin/types'
import { moduleFromPathname, modulePath } from '@/lib/module-routing'
import type { Module } from '@/lib/modules'
import styles from './TenantDetailClient.module.css'

interface Props {
  tenant: RestoTenant
  env: RestoAdminEnv
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number | string | null | undefined
}) {
  if (value == null || value === '') return null
  return (
    <div className={styles.deleteStat}>
      <span className={styles.deleteStatLabel}>{label}</span>
      <span className={styles.deleteStatValue}>{value}</span>
    </div>
  )
}

function SummaryBlock({ summary }: { summary: RestoTenantDeleteSummary }) {
  return (
    <div className={styles.deleteSummary}>
      <h4 className={styles.deleteSummaryTitle}>Deletion summary</h4>
      <div className={styles.deleteStatGrid}>
        <Stat label="Users" value={summary.usersDeleted} />
        <Stat label="Auth users" value={summary.authUsersDeleted} />
        <Stat label="Auth failures" value={summary.authUsersFailed} />
        <Stat label="Orders" value={summary.ordersDeleted} />
        <Stat label="Branches" value={summary.branchesDeleted} />
        <Stat label="API hits" value={summary.apiHitsDeleted} />
      </div>
      {summary.warnings.length > 0 && (
        <div className={styles.deleteWarnings}>
          <p className={styles.deleteWarningsTitle}>Warnings</p>
          <ul>
            {summary.warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 40)}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function TenantDeletePanel({ tenant, env }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const productModule: Module =
    moduleFromPathname(pathname)?.startsWith('ops_')
      ? (moduleFromPathname(pathname) as Module)
      : 'ops_resto'
  const [confirmName, setConfirmName] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [ack, setAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<RestoTenantDeleteSummary | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isProduction = env === 'production'
  const nameOk =
    confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase()
  const idOk = confirmId.trim() === tenant.id
  const canSubmit = ack && nameOk && idOk && !isPending && !done

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenant.id)}?env=${encodeURIComponent(env)}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmTenantId: tenant.id }),
          }
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(
            typeof body.error === 'string'
              ? body.error
              : `Delete failed (${response.status})`
          )
          return
        }
        setSummary(
          body.summary && typeof body.summary === 'object'
            ? (body.summary as RestoTenantDeleteSummary)
            : null
        )
        setDone(true)
      } catch {
        setError('Could not reach Reach server. Check your connection and try again.')
      }
    })
  }

  if (done) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Tenant deleted</h3>
        <p className={styles.panelBody}>
          <strong>{tenant.name}</strong> was permanently deleted from{' '}
          {isProduction ? 'Production' : 'Staging'}.
        </p>
        {summary && <SummaryBlock summary={summary} />}
        <div className={styles.deleteActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              router.push(
                `${modulePath(productModule, 'management')}?env=${env}`
              )
            }
          >
            Back to tenants
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.panel} ${styles.deletePanel}`}>
      <h3 className={styles.panelTitle}>Delete tenant</h3>
      <p className={styles.panelBody}>
        Permanently removes this restaurant from Resto (
        {isProduction ? 'Production' : 'Staging'}
        ): users, auth logins, branches, orders, menu, inventory, customers,
        subscriptions, API hits, audit logs, and the tenant row. This cannot be
        undone.
      </p>

      {isProduction && (
        <div className={styles.deleteProdBanner} role="status">
          You are targeting <strong>Production</strong>. Double-check the tenant
          before continuing.
        </div>
      )}

      <dl className={styles.deleteTarget}>
        <div>
          <dt>Restaurant</dt>
          <dd>{tenant.name}</dd>
        </div>
        <div>
          <dt>Tenant ID</dt>
          <dd className={styles.mono}>{tenant.id}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{isProduction ? 'Production' : 'Staging'}</dd>
        </div>
      </dl>

      <form className={styles.deleteForm} onSubmit={handleDelete}>
        <label className={styles.deleteField}>
          <span className={styles.fieldLabel}>Type restaurant name to confirm</span>
          <input
            className={styles.deleteInput}
            value={confirmName}
            onChange={e => setConfirmName(e.target.value)}
            placeholder={tenant.name}
            autoComplete="off"
            disabled={isPending}
          />
        </label>

        <label className={styles.deleteField}>
          <span className={styles.fieldLabel}>Type tenant ID to confirm</span>
          <input
            className={styles.deleteInput}
            value={confirmId}
            onChange={e => setConfirmId(e.target.value)}
            placeholder={tenant.id}
            autoComplete="off"
            spellCheck={false}
            disabled={isPending}
          />
        </label>

        <label className={styles.deleteCheck}>
          <input
            type="checkbox"
            checked={ack}
            onChange={e => setAck(e.target.checked)}
            disabled={isPending}
          />
          I understand this hard-deletes all Resto data for this tenant and cannot
          be undone.
        </label>

        {error && (
          <p className={styles.deleteError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.deleteActions}>
          <button
            type="submit"
            className={styles.dangerBtn}
            disabled={!canSubmit}
          >
            {isPending ? 'Deleting… (can take up to 2 min)' : 'Delete tenant permanently'}
          </button>
        </div>
      </form>
    </div>
  )
}
