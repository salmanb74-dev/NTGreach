'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type {
  RestoAdminEnv,
  RestoAdminTenantTab,
  RestoTenant,
} from '@/lib/resto-admin/types'
import LogsClient from '@/components/ops/LogsClient'
import TenantDeletePanel from '@/components/ops/TenantDeletePanel'
import { moduleFromPathname, modulePath } from '@/lib/module-routing'
import type { Module } from '@/lib/modules'
import styles from './TenantDetailClient.module.css'

const TABS: { id: RestoAdminTenantTab; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'reports',      label: 'Reports' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'delete',       label: 'Delete' },
  { id: 'logs',         label: 'Logs' },
]

interface Props {
  tenantId:   string
  initialEnv: RestoAdminEnv
  initialTab: RestoAdminTenantTab
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tenant: RestoTenant }
  | { status: 'error'; message: string }
  | { status: 'not_found' }

export default function TenantDetailClient({
  tenantId,
  initialEnv,
  initialTab,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const productModule: Module =
    moduleFromPathname(pathname)?.startsWith('ops_')
      ? (moduleFromPathname(pathname) as Module)
      : 'ops_resto'
  const managementHref = modulePath(productModule, 'management')
  const [env] = useState<RestoAdminEnv>(initialEnv)
  const [tab, setTab] = useState<RestoAdminTenantTab>(initialTab)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const response = await fetch(
        `/api/ops/tenants?env=${encodeURIComponent(env)}`,
        { cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          status: 'error',
          message: body.error ?? `Failed to load tenant (${response.status})`,
        })
        return
      }
      const tenants: RestoTenant[] = Array.isArray(body.tenants) ? body.tenants : []
      const tenant = tenants.find(t => t.id === tenantId)
      if (!tenant) {
        setState({ status: 'not_found' })
        return
      }
      setState({ status: 'ready', tenant })
    } catch {
      setState({
        status: 'error',
        message: 'Could not load tenant. Check your connection and try again.',
      })
    }
  }, [env, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  function selectTab(next: RestoAdminTenantTab) {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('env', env)
    url.searchParams.set('tab', next)
    router.replace(`${url.pathname}?${url.searchParams.toString()}`)
  }

  const isProduction = env === 'production'

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link
          href={`${managementHref}?env=${env}`}
          className={styles.backLink}
        >
          ← All tenants
        </Link>
        <span
          className={`${styles.envBadge} ${
            isProduction ? styles.envBadgeProduction : styles.envBadgeStaging
          }`}
        >
          {isProduction ? 'Production' : 'Staging'}
        </span>
      </div>

      {state.status === 'loading' && (
        <div className={styles.loadingBox} role="status">
          Loading tenant…
        </div>
      )}

      {state.status === 'error' && (
        <div className={styles.errorBox} role="alert">
          {state.message}
        </div>
      )}

      {state.status === 'not_found' && (
        <div className={styles.errorBox} role="alert">
          Tenant not found in {isProduction ? 'Production' : 'Staging'}.
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className={styles.header}>
            <h2 className={styles.title}>{state.tenant.name}</h2>
            <p className={styles.meta}>
              Tenant ID{' '}
              <span className={styles.mono}>{state.tenant.id}</span>
            </p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Tenant sections">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
                onClick={() => selectTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className={styles.panel}>
              <div className={styles.overviewGrid}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Restaurant</span>
                  <span className={styles.fieldValue}>{state.tenant.name}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Owner</span>
                  <span className={styles.fieldValue}>
                    {state.tenant.ownerName || (
                      <span className={styles.muted}>—</span>
                    )}
                  </span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Owner email</span>
                  <span className={styles.fieldValue}>
                    {state.tenant.ownerEmail || (
                      <span className={styles.muted}>—</span>
                    )}
                  </span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Tenant ID</span>
                  <span className={`${styles.fieldValue} ${styles.mono}`}>
                    {state.tenant.id}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Reports</h3>
              <p className={styles.panelBody}>
                Coming soon — tenant usage and support reports will live here.
              </p>
            </div>
          )}

          {tab === 'subscription' && (
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Subscription</h3>
              <p className={styles.panelBody}>
                Coming soon — plan and billing controls will live here.
              </p>
            </div>
          )}

          {tab === 'delete' && (
            <TenantDeletePanel tenant={state.tenant} env={env} />
          )}

          {tab === 'logs' && (
            <div className={styles.logsPanel}>
              <LogsClient
                initialEnv={env}
                initialTenantId={tenantId}
                lockTenantId
                embed
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
