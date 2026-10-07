'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type {
  AlmaAdminEnv,
  AlmaAdminTenantTab,
  AlmaTenant,
} from '@/lib/alma-admin/types'
import type {
  RestoAdminEnv,
  RestoAdminTenantTab,
  RestoTenant,
} from '@/lib/resto-admin/types'
import LogsClient from '@/components/ops/LogsClient'
import TenantCashPanel from '@/components/ops/TenantCashPanel'
import TenantDeletePanel from '@/components/ops/TenantDeletePanel'
import TenantOrdersLockPanel from '@/components/ops/TenantOrdersLockPanel'
import TenantAssessmentsLockPanel from '@/components/ops/TenantAssessmentsLockPanel'
import TenantSubscriptionPanel from '@/components/ops/TenantSubscriptionPanel'
import AlmaTenantSubscriptionPanel from '@/components/ops/AlmaTenantSubscriptionPanel'
import { moduleFromPathname, modulePath } from '@/lib/module-routing'
import type { Module } from '@/lib/modules'
import {
  opsApiBasePath,
  opsProductFromModule,
  type OpsNestProduct,
} from '@/lib/ops/product'
import styles from './TenantDetailClient.module.css'

type OpsAdminEnv = RestoAdminEnv | AlmaAdminEnv
type OpsAdminTenantTab = RestoAdminTenantTab | AlmaAdminTenantTab

const TABS: { id: OpsAdminTenantTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'reports', label: 'Reports' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'cash', label: 'Cash' },
  { id: 'delete', label: 'Delete' },
  { id: 'logs', label: 'Logs' },
]

interface Props {
  tenantId: string
  initialEnv: OpsAdminEnv
  initialTab: OpsAdminTenantTab
}

type TenantRow = RestoTenant | AlmaTenant

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tenant: TenantRow }
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
  const product: OpsNestProduct =
    opsProductFromModule(productModule) ?? 'resto'
  const apiBase = opsApiBasePath(product)
  const isAlma = product === 'alma'
  const managementHref = modulePath(productModule, 'management')
  const [env] = useState<OpsAdminEnv>(initialEnv)
  const [tab, setTab] = useState<OpsAdminTenantTab>(initialTab)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const response = await fetch(
        `${apiBase}/tenants?env=${encodeURIComponent(env)}`,
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
      const tenants: TenantRow[] = Array.isArray(body.tenants)
        ? body.tenants
        : []
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
  }, [apiBase, env, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  function selectTab(next: OpsAdminTenantTab) {
    if (next === 'cash' && env !== 'production') return
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('env', env)
    url.searchParams.set('tab', next)
    router.replace(`${url.pathname}?${url.searchParams.toString()}`)
  }

  useEffect(() => {
    if (tab === 'cash' && env !== 'production') {
      setTab('overview')
    }
  }, [tab, env])

  const isProduction = env === 'production'

  const lockBadge =
    state.status === 'ready'
      ? isAlma
        ? (state.tenant as AlmaTenant).assessmentsCreationLocked
        : (state.tenant as RestoTenant).ordersPlacementLocked
      : false

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
            <h2 className={styles.title}>
              {state.tenant.name}
              {lockBadge && (
                <span className={styles.ordersLockedBadge}>
                  {isAlma ? 'Assessments locked' : 'Orders locked'}
                </span>
              )}
            </h2>
            <p className={styles.meta}>
              Tenant ID{' '}
              <span className={styles.mono}>{state.tenant.id}</span>
            </p>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Tenant sections">
            {TABS.filter(item => item.id !== 'cash' || isProduction).map(item => (
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
            <>
              <div className={styles.panel}>
                <div className={styles.overviewGrid}>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>
                      {isAlma ? 'School' : 'Restaurant'}
                    </span>
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
              {isAlma ? (
                <TenantAssessmentsLockPanel
                  tenant={state.tenant as AlmaTenant}
                  env={env as AlmaAdminEnv}
                  onChanged={() => void load()}
                />
              ) : (
                <TenantOrdersLockPanel
                  tenant={state.tenant as RestoTenant}
                  env={env as RestoAdminEnv}
                  onChanged={() => void load()}
                />
              )}
            </>
          )}

          {tab === 'reports' && (
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Reports</h3>
              <p className={styles.panelBody}>
                Coming soon — tenant usage and support reports will live here.
              </p>
            </div>
          )}

          {tab === 'subscription' &&
            (isAlma ? (
              <AlmaTenantSubscriptionPanel
                tenantId={state.tenant.id}
                tenantName={state.tenant.name}
                env={env as AlmaAdminEnv}
              />
            ) : (
              <TenantSubscriptionPanel
                tenantId={state.tenant.id}
                tenantName={state.tenant.name}
                env={env as RestoAdminEnv}
              />
            ))}

          {tab === 'cash' && (
            <TenantCashPanel
              tenantId={state.tenant.id}
              tenantName={state.tenant.name}
              env={env}
              product={product}
              apiBase={apiBase}
            />
          )}

          {tab === 'delete' && (
            <TenantDeletePanel
              tenant={state.tenant}
              env={env}
              product={product}
              apiBase={apiBase}
            />
          )}

          {tab === 'logs' && (
            <div className={styles.logsPanel}>
              <LogsClient
                initialEnv={env}
                initialTenantId={tenantId}
                lockTenantId
                embed
                product={product}
                apiBase={apiBase}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
