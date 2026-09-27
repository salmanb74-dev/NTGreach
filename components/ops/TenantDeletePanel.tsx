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

async function tenantStillListed(
  env: RestoAdminEnv,
  tenantId: string
): Promise<boolean | null> {
  try {
    const response = await fetch(
      `/api/ops/tenants?env=${encodeURIComponent(env)}`,
      { cache: 'no-store' }
    )
    if (!response.ok) return null
    const body = await response.json().catch(() => null)
    const tenants = Array.isArray(body?.tenants) ? body.tenants : null
    if (!tenants) return null
    return tenants.some(
      (t: { id?: unknown }) => typeof t?.id === 'string' && t.id === tenantId
    )
  } catch {
    return null
  }
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
  const [confirmedAbsent, setConfirmedAbsent] = useState(false)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isProduction = env === 'production'
  const nameOk =
    confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase()
  const idOk = confirmId.trim() === tenant.id
  const canSubmit = ack && nameOk && idOk && !isPending && !done

  function markDeleted(opts: {
    summary?: RestoTenantDeleteSummary | null
    confirmedAbsent?: boolean
  }) {
    setSummary(opts.summary ?? null)
    setConfirmedAbsent(Boolean(opts.confirmedAbsent))
    setDone(true)
  }

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
        const body = await response.json().catch(() => ({} as Record<string, unknown>))

        // Nest may finish after the HTTP wait — 404 means already gone.
        if (response.status === 404) {
          markDeleted({ confirmedAbsent: true })
          return
        }

        if (response.ok) {
          markDeleted({
            summary:
              body.summary && typeof body.summary === 'object'
                ? (body.summary as RestoTenantDeleteSummary)
                : null,
            confirmedAbsent: body.confirmedAbsent === true,
          })
          return
        }

        // Gateway / Nest timeout: verify before asking the user to retry.
        if (response.status === 504 || response.status === 502) {
          const stillThere = await tenantStillListed(env, tenant.id)
          if (stillThere === false) {
            markDeleted({ confirmedAbsent: true })
            return
          }
          setError(
            stillThere === true
              ? 'Delete timed out and the tenant is still listed. Wait a minute, refresh the tenants list, then retry only if it is still there.'
              : 'Delete timed out. Check the tenants list before retrying — Nest may have already finished the wipe.'
          )
          return
        }

        setError(
          typeof body.error === 'string'
            ? body.error
            : `Delete failed (${response.status})`
        )
      } catch {
        const stillThere = await tenantStillListed(env, tenant.id)
        if (stillThere === false) {
          markDeleted({ confirmedAbsent: true })
          return
        }
        setError(
          stillThere === true
            ? 'Could not reach Reach server and the tenant is still listed. Check your connection, then retry only if needed.'
            : 'Could not reach Reach server. Check the tenants list before retrying — the delete may have completed.'
        )
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
        {confirmedAbsent && !summary && (
          <p className={styles.panelBody}>
            The delete request timed out or returned not-found, but the tenant is
            no longer listed — Nest finished the wipe. A detailed deletion summary
            was not returned.
          </p>
        )}
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
            {isPending
              ? 'Deleting… (large tenants can take several minutes)'
              : 'Delete tenant permanently'}
          </button>
        </div>
      </form>
    </div>
  )
}
