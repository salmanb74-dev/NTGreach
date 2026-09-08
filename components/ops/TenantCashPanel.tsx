'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  createCashCollection,
  deleteCashCollection,
  getCashTenant,
  updateCashCollection,
  upsertCashSettings,
} from '@/lib/actions/ops-cash'
import {
  cashDefaultsFromSubscription,
  formatDueLabel,
  formatMoney,
  todayISO,
  type CashCollectionKind,
  type CashDueStatus,
  type OpsCashCollection,
  type OpsCashTenant,
} from '@/lib/ops/cash-collection'
import type { RestoAdminEnv } from '@/lib/resto-admin/types'
import styles from './TenantCashPanel.module.css'

interface Props {
  tenantId: string
  tenantName: string
  env: RestoAdminEnv
}

type FormState = {
  kind: CashCollectionKind
  amount: string
  currency: string
  dueDate: string
  collectedOn: string
  notes: string
}

const KIND_LABEL: Record<CashCollectionKind, string> = {
  setup: 'Setup',
  recurring: 'Recurring',
  other: 'Other',
}

function emptyForm(settings: OpsCashTenant | null, due: CashDueStatus): FormState {
  const kind: CashCollectionKind = due.nextKind ?? 'recurring'
  const amount =
    kind === 'setup'
      ? settings?.default_setup_amount
      : kind === 'recurring'
        ? settings?.default_recurring_amount
        : null
  return {
    kind,
    amount: amount != null ? String(amount) : '',
    currency: settings?.currency ?? 'USD',
    dueDate: due.nextDue ?? settings?.schedule_anchor ?? todayISO(),
    collectedOn: todayISO(),
    notes: '',
  }
}

export default function TenantCashPanel({ tenantId, tenantName, env }: Props) {
  const isProduction = env === 'production'
  const [settings, setSettings] = useState<OpsCashTenant | null>(null)
  const [collections, setCollections] = useState<OpsCashCollection[]>([])
  const [due, setDue] = useState<CashDueStatus>({
    nextDue: null,
    overdue: false,
    dueSoon: false,
    nextKind: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(null, due))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [settingsForm, setSettingsForm] = useState({
    scheduleAnchor: '',
    cycleMonths: '1',
    defaultSetup: '',
    defaultRecurring: '',
    currency: 'USD',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCashTenant(tenantId)
      setSettings(data.settings)
      setCollections(data.collections)
      setDue(data.due)
      setForm(emptyForm(data.settings, data.due))
      if (data.settings) {
        setSettingsForm({
          scheduleAnchor: data.settings.schedule_anchor ?? '',
          cycleMonths: String(data.settings.cycle_months || 1),
          defaultSetup:
            data.settings.default_setup_amount != null
              ? String(data.settings.default_setup_amount)
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
  }, [tenantId])

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
        `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription?env=production`,
        { cache: 'no-store' }
      )
      if (!res.ok) return null
      const body = await res.json()
      return (body.subscription as Record<string, unknown>) ?? null
    } catch {
      return null
    }
  }, [tenantId])

  function toggleEnabled(next: boolean) {
    setMsg(null)
    setError(null)
    startTransition(async () => {
      try {
        const subscription = next ? await fetchSubscription() : null
        const saved = await upsertCashSettings({
          tenantId,
          enabled: next,
          subscription: subscription ?? undefined,
        })
        setSettings(saved)
        setMsg(
          next
            ? 'Cash collection enabled. Schedule defaults pulled from subscription when available.'
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
    const recurring =
      settingsForm.defaultRecurring.trim() === ''
        ? null
        : Number(settingsForm.defaultRecurring)
    if (setup != null && (!Number.isFinite(setup) || setup < 0)) {
      setError('Invalid setup amount')
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
          enabled: true,
          scheduleAnchor: settingsForm.scheduleAnchor || null,
          cycleMonths: Math.floor(cycle),
          defaultSetupAmount: setup,
          defaultRecurringAmount: recurring,
          currency: settingsForm.currency || 'USD',
        })
        setSettings(saved)
        setMsg('Schedule settings saved.')
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
        const saved = await upsertCashSettings({
          tenantId,
          enabled: true,
          subscription: subscription ?? undefined,
          scheduleAnchor: d.scheduleAnchor,
          cycleMonths: d.cycleMonths,
          defaultSetupAmount: d.defaultSetupAmount,
          defaultRecurringAmount: d.defaultRecurringAmount,
          currency: d.currency,
        })
        setSettings(saved)
        setMsg('Synced schedule and amounts from subscription.')
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      }
    })
  }

  function onKindChange(kind: CashCollectionKind) {
    setForm(prev => {
      const amount =
        kind === 'setup'
          ? settings?.default_setup_amount
          : kind === 'recurring'
            ? settings?.default_recurring_amount
            : null
      return {
        ...prev,
        kind,
        amount:
          amount != null
            ? String(amount)
            : kind === prev.kind
              ? prev.amount
              : '',
        dueDate:
          kind === due.nextKind && due.nextDue
            ? due.nextDue
            : prev.dueDate || settings?.schedule_anchor || todayISO(),
      }
    })
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm(settings, due))
    setShowForm(true)
    setMsg(null)
    setError(null)
  }

  function openEdit(row: OpsCashCollection) {
    setEditingId(row.id)
    setForm({
      kind: row.kind,
      amount: String(row.amount),
      currency: row.currency,
      dueDate: row.due_date,
      collectedOn: row.collected_on,
      notes: row.notes ?? '',
    })
    setShowForm(true)
    setMsg(null)
    setError(null)
  }

  function submitForm() {
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid amount')
      return
    }
    if (!form.dueDate || !form.collectedOn) {
      setError('Due date and collected-on are required')
      return
    }
    setError(null)
    setMsg(null)
    startTransition(async () => {
      try {
        if (editingId) {
          await updateCashCollection({
            id: editingId,
            tenantId,
            kind: form.kind,
            amount,
            currency: form.currency,
            dueDate: form.dueDate,
            collectedOn: form.collectedOn,
            notes: form.notes,
          })
          setMsg('Collection updated.')
        } else {
          await createCashCollection({
            tenantId,
            kind: form.kind,
            amount,
            currency: form.currency,
            dueDate: form.dueDate,
            collectedOn: form.collectedOn,
            notes: form.notes,
          })
          setMsg('Collection recorded.')
        }
        setShowForm(false)
        setEditingId(null)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function removeCollection(row: OpsCashCollection) {
    if (
      !window.confirm(
        `Delete ${KIND_LABEL[row.kind]} collection of ${formatMoney(
          row.amount,
          row.currency
        )} due ${row.due_date}?`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await deleteCashCollection(row.id, tenantId)
        setMsg('Collection deleted.')
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
            Track cash received for this resto tenant. Next due follows the
            subscription schedule, not the collection date.
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
                {due.nextKind ? ` · ${KIND_LABEL[due.nextKind]}` : ''}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Schedule</span>
              <span className={styles.metaValue}>{scheduleSummary}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Default setup</span>
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
              <span className={styles.metaLabel}>Default recurring</span>
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
                <span>Default setup</span>
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
                <span>Default recurring</span>
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

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={isPending}
              onClick={openCreate}
            >
              Mark collected
            </button>
          </div>

          {showForm && (
            <div className={styles.formCard}>
              <h4 className={styles.formTitle}>
                {editingId ? 'Edit collection' : 'Record collection'}
              </h4>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Type</span>
                  <select
                    value={form.kind}
                    onChange={e =>
                      onKindChange(e.target.value as CashCollectionKind)
                    }
                  >
                    <option value="recurring">Recurring</option>
                    <option value="setup">Setup</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e =>
                      setForm(f => ({ ...f, amount: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Currency</span>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        currency: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Due date (schedule)</span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e =>
                      setForm(f => ({ ...f, dueDate: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Collected on</span>
                  <input
                    type="date"
                    value={form.collectedOn}
                    onChange={e =>
                      setForm(f => ({ ...f, collectedOn: e.target.value }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e =>
                      setForm(f => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={isPending}
                  onClick={submitForm}
                >
                  {editingId ? 'Save changes' : 'Save collection'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={isPending}
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <h4 className={styles.sectionTitle}>History</h4>
          {collections.length === 0 ? (
            <p className={styles.body}>No collections recorded yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Due</th>
                    <th>Collected</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {collections.map(row => (
                    <tr key={row.id}>
                      <td>{KIND_LABEL[row.kind]}</td>
                      <td>{row.due_date}</td>
                      <td>{row.collected_on}</td>
                      <td>{formatMoney(row.amount, row.currency)}</td>
                      <td className={styles.notes}>
                        {row.notes || <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={isPending}
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={isPending}
                          onClick={() => removeCollection(row)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!enabled && (
        <p className={styles.body}>
          Enable cash collection to track setup and recurring payments for this
          tenant.
        </p>
      )}
    </div>
  )
}
