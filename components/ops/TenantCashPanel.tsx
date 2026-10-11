'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  deleteCashCollection,
  getCashTenant,
  recordCashPayment,
  syncCashDefaultsFromSubscription,
  updateCashCollection,
  upsertCashSettings,
} from '@/lib/actions/ops-cash'
import {
  CASH_KIND_LABEL,
  CASH_STATUS_LABEL,
  cashDefaultsFromSubscription,
  formatDueLabel,
  formatMoney,
  todayISO,
  type CashCollectionStatus,
  type CashDueStatus,
  type OpsCashCollection,
  type OpsCashTenant,
} from '@/lib/ops/cash-collection'
import type { AlmaAdminEnv } from '@/lib/alma-admin/types'
import type { RestoAdminEnv } from '@/lib/resto-admin/types'
import type { CashProduct } from '@/lib/ops/cash-collection'
import type { OpsNestProduct } from '@/lib/ops/product'
import styles from './TenantCashPanel.module.css'

type OpsAdminEnv = RestoAdminEnv | AlmaAdminEnv

interface Props {
  tenantId: string
  tenantName: string
  env: OpsAdminEnv
  product?: OpsNestProduct
  apiBase?: '/api/ops' | '/api/ops/alma'
}

type CollectDraft = {
  amount: string
  collectedOn: string
  notes: string
}

function emptyDue(): CashDueStatus {
  return {
    nextDue: null,
    overdue: false,
    dueSoon: false,
    nextKind: null,
    nextExpectedAmount: null,
    nextAmountCollected: null,
    nextRowId: null,
  }
}

function statusClass(status: CashCollectionStatus): string {
  if (status === 'collected') return styles.statusCollected
  if (status === 'partial') return styles.statusPartial
  return styles.statusDue
}

export default function TenantCashPanel({
  tenantId,
  tenantName,
  env,
  product = 'resto',
  apiBase = product === 'alma' ? '/api/ops/alma' : '/api/ops',
}: Props) {
  const cashProduct: CashProduct = product
  const isProduction = env === 'production'
  const [settings, setSettings] = useState<OpsCashTenant | null>(null)
  const [collections, setCollections] = useState<OpsCashCollection[]>([])
  const [due, setDue] = useState<CashDueStatus>(emptyDue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CollectDraft>({
    amount: '',
    collectedOn: todayISO(),
    notes: '',
  })
  const [isPending, startTransition] = useTransition()

  const [settingsForm, setSettingsForm] = useState({
    scheduleAnchor: '',
    cycleMonths: '1',
    defaultSetup: '',
    defaultPreTrialSetup: '',
    defaultRecurring: '',
    currency: 'USD',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCashTenant(tenantId, cashProduct)
      setSettings(data.settings)
      setCollections(data.collections)
      setDue(data.due)
      if (data.settings) {
        setSettingsForm({
          scheduleAnchor: data.settings.schedule_anchor ?? '',
          cycleMonths: String(data.settings.cycle_months || 1),
          defaultSetup:
            data.settings.default_setup_amount != null
              ? String(data.settings.default_setup_amount)
              : '',
          defaultPreTrialSetup:
            data.settings.default_pre_trial_setup_amount != null
              ? String(data.settings.default_pre_trial_setup_amount)
              : '',
          defaultRecurring:
            data.settings.default_recurring_amount != null
              ? String(data.settings.default_recurring_amount)
              : '',
          currency: data.settings.currency || 'USD',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash data')
    } finally {
      setLoading(false)
    }
  }, [cashProduct, tenantId])

  useEffect(() => {
    if (!isProduction) return
    void load()
  }, [isProduction, load])

  const fetchSubscription = useCallback(async (): Promise<Record<
    string,
    unknown
  > | null> => {
    try {
      const res = await fetch(
        `${apiBase}/tenants/${encodeURIComponent(tenantId)}/subscription?env=production`,
        { cache: 'no-store' }
      )
      if (!res.ok) return null
      const body = await res.json()
      return (body.subscription as Record<string, unknown>) ?? null
    } catch {
      return null
    }
  }, [apiBase, tenantId])

  function toggleEnabled(next: boolean) {
    setMsg(null)
    setError(null)
    startTransition(async () => {
      try {
        const subscription = next ? await fetchSubscription() : null
        const saved = await upsertCashSettings({
          tenantId,
          product: cashProduct,
          enabled: next,
          subscription: subscription ?? undefined,
        })
        setSettings(saved)
        setMsg(
          next
            ? 'Cash collection enabled. Expected dues generated from enterprise terms when available.'
            : 'Cash collection disabled for this tenant.'
        )
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update settings')
      }
    })
  }

  function saveSchedule() {
    setMsg(null)
    setError(null)
    const cycle = Number(settingsForm.cycleMonths)
    if (!Number.isFinite(cycle) || cycle < 1) {
      setError('Cycle months must be at least 1')
      return
    }
    const setup =
      settingsForm.defaultSetup.trim() === ''
        ? null
        : Number(settingsForm.defaultSetup)
    const preTrial =
      settingsForm.defaultPreTrialSetup.trim() === ''
        ? null
        : Number(settingsForm.defaultPreTrialSetup)
    const recurring =
      settingsForm.defaultRecurring.trim() === ''
        ? null
        : Number(settingsForm.defaultRecurring)
    if (setup != null && (!Number.isFinite(setup) || setup < 0)) {
      setError('Invalid setup amount')
      return
    }
    if (preTrial != null && (!Number.isFinite(preTrial) || preTrial < 0)) {
      setError('Invalid pre-trial setup amount')
      return
    }
    if (recurring != null && (!Number.isFinite(recurring) || recurring < 0)) {
      setError('Invalid recurring amount')
      return
    }
    startTransition(async () => {
      try {
        const saved = await upsertCashSettings({
          tenantId,
          product: cashProduct,
          enabled: true,
          scheduleAnchor: settingsForm.scheduleAnchor || null,
          cycleMonths: Math.floor(cycle),
          defaultSetupAmount: setup,
          defaultPreTrialSetupAmount: preTrial,
          defaultRecurringAmount: recurring,
          currency: settingsForm.currency || 'USD',
        })
        setSettings(saved)
        setMsg('Schedule saved. Unpaid future dues refreshed.')
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save schedule')
      }
    })
  }

  function syncFromSubscription() {
    setMsg(null)
    setError(null)
    startTransition(async () => {
      try {
        const subscription = await fetchSubscription()
        const d = cashDefaultsFromSubscription(subscription)
        if (!d.isEnterprise) {
          setError(
            'No enterprise terms on this subscription — cash sync is enterprise-only.'
          )
          return
        }
        const saved = await syncCashDefaultsFromSubscription(
          tenantId,
          subscription,
          cashProduct
        )
        setSettings(saved)
        setMsg(
          'Synced from enterprise subscription. Past dues kept; unpaid future replaced.'
        )
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      }
    })
  }

  function openCollect(row: OpsCashCollection) {
    setActiveRowId(row.id)
    setDraft({
      amount:
        row.amount_collected > 0
          ? String(row.amount_collected)
          : String(row.expected_amount),
      collectedOn: row.collected_on ?? todayISO(),
      notes: row.notes ?? '',
    })
    setMsg(null)
    setError(null)
  }

  function cancelCollect() {
    setActiveRowId(null)
  }

  function submitCollect(row: OpsCashCollection) {
    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid collected amount')
      return
    }
    if (amount > 0 && !draft.collectedOn) {
      setError('Collection date is required')
      return
    }
    setError(null)
    setMsg(null)
    startTransition(async () => {
      try {
        await recordCashPayment({
          id: row.id,
          tenantId,
          product: cashProduct,
          amountCollected: amount,
          collectedOn: draft.collectedOn || null,
          notes: draft.notes,
        })
        const status =
          amount <= 0
            ? 'cleared'
            : amount < row.expected_amount
              ? 'partial'
              : 'collected'
        setMsg(
          status === 'partial'
            ? 'Partial collection recorded.'
            : status === 'collected'
              ? 'Collection recorded.'
              : 'Collection cleared.'
        )
        setActiveRowId(null)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function saveExpected(row: OpsCashCollection, expectedRaw: string) {
    const expected = Number(expectedRaw)
    if (!Number.isFinite(expected) || expected < 0) {
      setError('Invalid expected amount')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await updateCashCollection({
          id: row.id,
          tenantId,
          product: cashProduct,
          expectedAmount: expected,
          amountCollected: row.amount_collected,
          collectedOn: row.collected_on,
          notes: row.notes,
        })
        setMsg('Expected amount updated.')
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed')
      }
    })
  }

  function removeCollection(row: OpsCashCollection) {
    if (
      !window.confirm(
        `Delete ${CASH_KIND_LABEL[row.kind]} due ${row.due_date}? This removes the expected row.`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await deleteCashCollection(row.id, tenantId, cashProduct)
        setMsg('Row deleted. It may reappear on the next schedule sync if still expected.')
        if (activeRowId === row.id) setActiveRowId(null)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  const enabled = settings?.enabled === true

  const scheduleSummary = useMemo(() => {
    if (!settings?.schedule_anchor) return 'No schedule anchor set'
    return `Anchor ${settings.schedule_anchor} · every ${settings.cycle_months} mo`
  }, [settings])

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? 1 : -1
      return a.kind.localeCompare(b.kind)
    })
  }, [collections])

  if (!isProduction) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.title}>Cash collection</h3>
        <p className={styles.body}>
          Cash tracking is available in Production only. Switch environment to
          Production to enable and record collections for {tenantName}.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.panel} role="status">
        Loading cash collection…
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>Cash collection</h3>
          <p className={styles.body}>
            Expected dues for all past cycles plus one future. Record a
            collected amount on each row — less than expected marks it partial.
          </p>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={isPending}
            onChange={e => toggleEnabled(e.target.checked)}
          />
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {msg && <div className={styles.success}>{msg}</div>}

      {enabled && settings && (
        <>
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Next due</span>
              <span
                className={`${styles.metaValue} ${
                  due.dueSoon ? styles.dueAlert : ''
                }`}
              >
                {formatDueLabel(due)}
                {due.nextKind ? ` · ${CASH_KIND_LABEL[due.nextKind]}` : ''}
                {due.nextExpectedAmount != null
                  ? ` · ${formatMoney(due.nextExpectedAmount, settings.currency)}`
                  : ''}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Schedule</span>
              <span className={styles.metaValue}>{scheduleSummary}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Setup</span>
              <span className={styles.metaValue}>
                {settings.default_setup_amount != null
                  ? formatMoney(
                      settings.default_setup_amount,
                      settings.currency
                    )
                  : '—'}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Pre-trial setup</span>
              <span className={styles.metaValue}>
                {settings.default_pre_trial_setup_amount != null
                  ? formatMoney(
                      settings.default_pre_trial_setup_amount,
                      settings.currency
                    )
                  : '—'}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Recurring</span>
              <span className={styles.metaValue}>
                {settings.default_recurring_amount != null
                  ? formatMoney(
                      settings.default_recurring_amount,
                      settings.currency
                    )
                  : '—'}
              </span>
            </div>
          </div>

          <div className={styles.formCard}>
            <h4 className={styles.formTitle}>Schedule defaults</h4>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Anchor (start)</span>
                <input
                  type="date"
                  value={settingsForm.scheduleAnchor}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      scheduleAnchor: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Cycle (months)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={settingsForm.cycleMonths}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      cycleMonths: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Currency</span>
                <input
                  type="text"
                  value={settingsForm.currency}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Enterprise setup</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.defaultSetup}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      defaultSetup: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Pre-trial setup</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.defaultPreTrialSetup}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      defaultPreTrialSetup: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Recurring</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.defaultRecurring}
                  onChange={e =>
                    setSettingsForm(f => ({
                      ...f,
                      defaultRecurring: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={isPending}
                onClick={saveSchedule}
              >
                Save schedule
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={isPending}
                onClick={syncFromSubscription}
              >
                Sync from subscription
              </button>
            </div>
          </div>

          <h4 className={styles.sectionTitle}>Expected collections</h4>
          {sortedCollections.length === 0 ? (
            <p className={styles.body}>
              No expected dues yet. Set an anchor and amounts, or sync from an
              enterprise subscription.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Due</th>
                    <th>Expected</th>
                    <th>Collected</th>
                    <th>Collected on</th>
                    <th>Status</th>
                    <th>Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedCollections.map(row => {
                    const isActive = activeRowId === row.id
                    return (
                      <tr key={row.id}>
                        <td>{CASH_KIND_LABEL[row.kind]}</td>
                        <td>{row.due_date}</td>
                        <td>
                          {isActive ? (
                            <input
                              className={styles.inlineInput}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={String(row.expected_amount)}
                              onBlur={e => {
                                if (
                                  e.target.value !== String(row.expected_amount)
                                ) {
                                  saveExpected(row, e.target.value)
                                }
                              }}
                              aria-label="Expected amount"
                            />
                          ) : (
                            formatMoney(row.expected_amount, row.currency)
                          )}
                        </td>
                        <td>
                          {row.amount_collected > 0
                            ? formatMoney(row.amount_collected, row.currency)
                            : '—'}
                        </td>
                        <td>{row.collected_on ?? '—'}</td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${statusClass(
                              row.status
                            )}`}
                          >
                            {CASH_STATUS_LABEL[row.status]}
                          </span>
                        </td>
                        <td className={styles.notes}>
                          {row.notes || <span className={styles.muted}>—</span>}
                        </td>
                        <td className={styles.rowActions}>
                          {!isActive ? (
                            <>
                              <button
                                type="button"
                                className={styles.linkBtn}
                                disabled={isPending}
                                onClick={() => openCollect(row)}
                              >
                                {row.status === 'due' ? 'Collect' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={isPending}
                                onClick={() => removeCollection(row)}
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeRowId &&
            (() => {
              const row = collections.find(c => c.id === activeRowId)
              if (!row) return null
              const remaining = Math.max(
                0,
                row.expected_amount - (Number(draft.amount) || 0)
              )
              const willPartial =
                Number(draft.amount) > 0 &&
                Number(draft.amount) < row.expected_amount
              return (
                <div className={styles.formCard}>
                  <h4 className={styles.formTitle}>
                    {CASH_KIND_LABEL[row.kind]} · due {row.due_date}
                  </h4>
                  <p className={styles.body}>
                    Expected{' '}
                    {formatMoney(row.expected_amount, row.currency)}. Enter what
                    was received
                    {willPartial
                      ? ` — will mark partial (short ${formatMoney(
                          remaining,
                          row.currency
                        )})`
                      : ''}
                    .
                  </p>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>Amount collected</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.amount}
                        onChange={e =>
                          setDraft(d => ({ ...d, amount: e.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Collected on</span>
                      <input
                        type="date"
                        value={draft.collectedOn}
                        onChange={e =>
                          setDraft(d => ({
                            ...d,
                            collectedOn: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span>Note (5 words max)</span>
                      <input
                        type="text"
                        value={draft.notes}
                        onChange={e =>
                          setDraft(d => ({ ...d, notes: e.target.value }))
                        }
                        placeholder="Optional"
                        maxLength={60}
                      />
                    </label>
                  </div>
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={isPending}
                      onClick={() => submitCollect(row)}
                    >
                      Collected
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={isPending}
                      onClick={cancelCollect}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            })()}
        </>
      )}

      {!enabled && (
        <p className={styles.body}>
          Enable cash collection to generate expected setup and recurring dues
          for this tenant (enterprise terms).
        </p>
      )}
    </div>
  )
}
