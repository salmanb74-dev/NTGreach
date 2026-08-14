'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import type { RestoAdminEnv, RestoSubscriptionSnapshot } from '@/lib/resto-admin/types'
import { resolveActivePlanView } from '@/lib/resto-admin/plan-catalog'
import ConfirmModal from '@/components/modals/ConfirmModal'
import CompareRow from './subscription/CompareRow'
import LimitField from './subscription/LimitField'
import {
  type FormState,
  DEFAULT_OFFER,
  offerToForm,
  formToOffer,
  formOfferFromSubscription,
  formDiffs,
  currentValues,
  fmtMoney,
  minAccessDatetimeLocal,
  newOfferStatusLabel,
  needsEnterpriseClearForce,
  subHasSavedOffer,
} from './subscription/offer-form'
import styles from './TenantSubscription.module.css'

type CancelOfferDialog = {
  force: boolean
  title: string
  message: string
}

interface Props {
  tenantId: string
  tenantName: string
  env: RestoAdminEnv
}

export default function TenantSubscriptionPanel({
  tenantId,
  tenantName,
  env,
}: Props) {
  const [loadError, setLoadError] = useState<string | null>(null)
  const [noSubYet, setNoSubYet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] =
    useState<RestoSubscriptionSnapshot | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [form, setForm] = useState<FormState>(() => offerToForm(DEFAULT_OFFER))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [cancelDialog, setCancelDialog] = useState<CancelOfferDialog | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  const termTotalPreview = useMemo(() => {
    const monthly = Number(form.monthlyPrice)
    const months = Number(form.durationMonths)
    if (
      !Number.isFinite(monthly) ||
      monthly <= 0 ||
      !Number.isFinite(months) ||
      months <= 0
    ) {
      return null
    }
    return monthly * months
  }, [form.monthlyPrice, form.durationMonths])

  const accessMin = minAccessDatetimeLocal()
  const activePlan = useMemo(
    () => resolveActivePlanView(subscription),
    [subscription]
  )
  const current = useMemo(
    () => currentValues(activePlan, subscription),
    [activePlan, subscription]
  )
  const newStatus = useMemo(
    () => newOfferStatusLabel(subscription),
    [subscription]
  )
  const canCancelOffer = Boolean(newStatus)
  const needsForceCancel = needsEnterpriseClearForce(subscription)
  const diffs = useMemo(
    () => formDiffs(form, activePlan, termTotalPreview),
    [form, activePlan, termTotalPreview]
  )
  const setupFeePaidUsd = subscription?.setupFeePaidUsd ?? null

  const applySubscription = useCallback(
    (sub: RestoSubscriptionSnapshot | null, bodyNotes?: string[]) => {
      setSubscription(sub)
      if (bodyNotes) setNotes(bodyNotes)
      setForm(offerToForm(formOfferFromSubscription(sub)))
    },
    []
  )

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        setLoading(true)
        setLoadError(null)
      }
      setNoSubYet(false)
      try {
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription?env=${encodeURIComponent(env)}`,
          { cache: 'no-store' }
        )
        const body = await res.json().catch(() => ({}))
        if (res.status === 404) {
          setNoSubYet(true)
          applySubscription(null, [])
          setLoadError(null)
          return
        }
        if (!res.ok) {
          setLoadError(
            typeof body.error === 'string'
              ? body.error
              : `Failed to load subscription (${res.status})`
          )
          return
        }
        const sub = (body.subscription ?? null) as RestoSubscriptionSnapshot | null
        setNoSubYet(false)
        applySubscription(sub, Array.isArray(body.notes) ? body.notes : [])
      } catch {
        setLoadError(
          'Could not load subscription. Check connection and try again.'
        )
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [applySubscription, env, tenantId]
  )

  useEffect(() => {
    void load()
  }, [load])

  function patchForm(partial: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...partial }))
    setSavedMsg(null)
    setSaveError(null)
  }

  function requestCancelOffer() {
    setSaveError(null)
    setSavedMsg(null)
    const force = needsForceCancel
    setCancelDialog({
      force,
      title: force ? 'Cancel re-offer?' : 'Cancel pending offer?',
      message: force
        ? `This tenant already has live Enterprise terms. Cancel the pending re-offer only?\n\nLive plan, current Enterprise terms, Stripe, and total setup fees paid are kept.`
        : `Cancel the pending Enterprise offer for ${tenantName}?\n\nThis clears the sales offer only. The current plan is unchanged.`,
    })
  }

  function executeCancelOffer(force: boolean) {
    setSaveError(null)
    setSavedMsg(null)

    startTransition(async () => {
      async function doDelete(useForce: boolean) {
        const qs = new URLSearchParams({ env })
        if (useForce) qs.set('force', 'true')
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription/enterprise?${qs}`,
          {
            method: 'DELETE',
            headers: useForce
              ? { 'Content-Type': 'application/json' }
              : undefined,
            body: useForce ? JSON.stringify({ force: true }) : undefined,
          }
        )
        const body = await res.json().catch(() => ({}))
        return { res, body }
      }

      try {
        const { res, body } = await doDelete(force)

        // Nest 409: already Enterprise / has current_enterprise_price — need force
        if (res.status === 409 && !force) {
          setCancelDialog({
            force: true,
            title: 'Force cancel pending offer?',
            message: `${typeof body.error === 'string' ? body.error : 'This tenant has live Enterprise terms.'}\n\nCancel the pending offer only? Live plan and setup paid balance are kept.`,
          })
          return
        }

        if (!res.ok) {
          setCancelDialog(null)
          setSaveError(
            typeof body.error === 'string'
              ? body.error
              : `Cancel failed (${res.status})`
          )
          return
        }

        setCancelDialog(null)

        const notesFromDelete = Array.isArray(body.notes) ? body.notes : []
        if (body.subscription != null) {
          applySubscription(
            body.subscription as RestoSubscriptionSnapshot,
            notesFromDelete
          )
        } else {
          await load({ quiet: true })
          if (notesFromDelete.length) setNotes(notesFromDelete)
        }

        setSavedMsg(
          body.cleared
            ? 'Pending offer cancelled. Current plan and live terms unchanged.'
            : 'No pending offer to cancel.'
        )
      } catch {
        setCancelDialog(null)
        setSaveError('Could not cancel offer. Check connection and try again.')
      }
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSavedMsg(null)
    const offer = formToOffer(form)
    if ('error' in offer) {
      setSaveError(offer.error)
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription/enterprise?env=${encodeURIComponent(env)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(offer),
          }
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSaveError(
            typeof body.error === 'string'
              ? body.error
              : `Save failed (${res.status})`
          )
          return
        }

        let sub = (body.subscription ?? null) as RestoSubscriptionSnapshot | null
        // Confirm Nest actually wrote offer fields (not only HTTP 200)
        if (!sub || !subHasSavedOffer(sub)) {
          // Re-fetch once in case response body was partial
          const reload = await fetch(
            `/api/ops/tenants/${encodeURIComponent(tenantId)}/subscription?env=${encodeURIComponent(env)}`,
            { cache: 'no-store' }
          )
          const reloadBody = await reload.json().catch(() => ({}))
          sub = (reloadBody.subscription ?? null) as RestoSubscriptionSnapshot | null
        }

        if (!sub || !subHasSavedOffer(sub)) {
          setSaveError(
            'Server returned success but no Enterprise offer was stored. Check Nest admin API / DB.'
          )
          return
        }

        // Term price must match what we sent (allow tiny float noise)
        if (
          sub.enterprisePrice != null &&
          Math.abs(Number(sub.enterprisePrice) - offer.price) > 0.05
        ) {
          setSaveError(
            `Offer stored with price ${sub.enterprisePrice}, expected ${offer.price}. Reload and verify.`
          )
        }

        applySubscription(
          sub,
          Array.isArray(body.notes) ? body.notes : []
        )
        setNoSubYet(false)

        // Refresh full snapshot (current plan + live terms) after write
        await load({ quiet: true })

        const livePlan = sub.planId ?? 'unknown'
        setSavedMsg(
          `Offer saved and pending. Current plan stays “${livePlan}” until the tenant accepts (portal / Apply terms) — only the New column is updated by Save.`
        )
      } catch {
        setSaveError('Could not save. Check connection and try again.')
      }
    })
  }

  if (loading) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Loading subscription…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.title}>Subscription</h3>
        <p className={styles.error} role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form className={styles.panel} onSubmit={handleSave}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>Subscription — {tenantName}</h3>
          <p className={styles.subline}>
            New: Enterprise sales offer. Current: live plan. Setup fees on New
            are charges for this offer (0 = no charge, not compared to prior).
            Highlighted rows differ / are charging. Total setup charged = lifetime
            paid to date (from API when available).
            {noSubYet
              ? ' No subscription yet — save creates a free shell.'
              : ''}
            {newStatus
              ? ` Offer status: ${newStatus}.`
              : !subHasSavedOffer(subscription) && subscription
                ? ' New is prefilled from current until you save an offer.'
                : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void load()}
            disabled={isPending}
          >
            Reload
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={isPending || !canCancelOffer}
            title={
              !canCancelOffer
                ? 'No pending Enterprise offer to cancel'
                : needsForceCancel
                  ? 'Cancel pending re-offer (tenant already on Enterprise)'
                  : 'Cancel pending Enterprise offer'
            }
            onClick={() => requestCancelOffer()}
          >
            Cancel pending offer
          </button>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : 'Save offer'}
          </button>
        </div>
      </div>

      <div className={styles.compareScroll}>
        <div className={styles.compare}>
          <div className={styles.headName} />
          <div className={styles.headNew}>New offer</div>
          <div className={styles.headCur}>Current plan</div>

          <CompareRow
            label="Plan"
            newCell={
              <span className={styles.mutedVal}>Enterprise offer</span>
            }
            currentCell={current.plan}
          />
          <CompareRow
            label="Status"
            newCell={
              newStatus ? (
                <span className={styles.pendingBadge}>{newStatus}</span>
              ) : (
                <span className={styles.mutedVal}>—</span>
              )
            }
            currentCell={current.status}
          />
          <CompareRow
            label="Recurring (USD/mo)"
            diff={diffs.monthly}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0.01}
                step="any"
                value={form.monthlyPrice}
                onChange={e => patchForm({ monthlyPrice: e.target.value })}
                required
              />
            }
            currentCell={current.monthly}
          />
          <CompareRow
            label="Duration (mo)"
            diff={diffs.duration}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={1}
                step={1}
                value={form.durationMonths}
                onChange={e => patchForm({ durationMonths: e.target.value })}
                required
              />
            }
            currentCell={current.duration}
          />
          <CompareRow
            label="Term total"
            diff={diffs.termTotal}
            newCell={
              <strong>
                {termTotalPreview != null ? fmtMoney(termTotalPreview) : '—'}
              </strong>
            }
            currentCell={current.termTotal}
          />
          <CompareRow
            label="Branches"
            diff={diffs.locations}
            newCell={
              <LimitField
                form={form}
                valueKey="locations"
                unlKey="locationsUnlimited"
                patchForm={patchForm}
              />
            }
            currentCell={current.locations}
          />
          <CompareRow
            label="Users"
            diff={diffs.users}
            newCell={
              <LimitField
                form={form}
                valueKey="users"
                unlKey="usersUnlimited"
                patchForm={patchForm}
              />
            }
            currentCell={current.users}
          />
          <CompareRow
            label="Counters"
            diff={diffs.counters}
            newCell={
              <LimitField
                form={form}
                valueKey="counters"
                unlKey="countersUnlimited"
                patchForm={patchForm}
              />
            }
            currentCell={current.counters}
          />
          <CompareRow
            label="Orders / mo"
            diff={diffs.orders}
            newCell={
              <LimitField
                form={form}
                valueKey="ordersPerMonth"
                unlKey="ordersUnlimited"
                patchForm={patchForm}
              />
            }
            currentCell={current.orders}
          />
          {(
            [
              {
                key: 'callCenter' as const,
                feeKey: 'callCenterFee' as const,
                label: 'Call center',
              },
              {
                key: 'kds' as const,
                feeKey: 'kdsFee' as const,
                label: 'KDS',
              },
              {
                key: 'inventory' as const,
                feeKey: 'inventoryFee' as const,
                label: 'Inventory',
              },
              {
                key: 'support' as const,
                feeKey: 'supportFee' as const,
                label: 'Operation Support',
              },
              {
                key: 'webOrdering' as const,
                feeKey: 'webOrderingFee' as const,
                label: 'Web ordering',
              },
            ] as const
          ).map(({ key, feeKey, label }) => (
            <CompareRow
              key={key}
              label={label}
              diff={diffs[key]}
              newCell={
                <div className={styles.addonCol}>
                  <label className={styles.checkSm}>
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => {
                        const on = e.target.checked
                        patchForm({
                          [key]: on,
                          ...(on
                            ? {}
                            : key === 'webOrdering'
                              ? {
                                  [feeKey]: '',
                                  webOrderingRevenuePercent: '',
                                }
                              : { [feeKey]: '' }),
                        })
                      }}
                    />
                    {form[key] ? 'Yes' : 'No'}
                  </label>
                  {form[key] && (
                    <>
                      <input
                        className={styles.inputSm}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="$ / mo (Nest TBD)"
                        value={form[feeKey]}
                        onChange={e =>
                          patchForm({ [feeKey]: e.target.value })
                        }
                        title="Monthly add-on fee — stored in Reach UI only until Nest accepts fee fields"
                      />
                      {key === 'webOrdering' && (
                        <input
                          className={styles.inputSm}
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          placeholder="% revenue (Nest TBD)"
                          value={form.webOrderingRevenuePercent}
                          onChange={e =>
                            patchForm({
                              webOrderingRevenuePercent: e.target.value,
                            })
                          }
                          title="Revenue share for month-end invoice — Nest placeholder"
                        />
                      )}
                    </>
                  )}
                </div>
              }
              currentCell={
                key === 'callCenter'
                  ? current.callCenter
                  : key === 'kds'
                    ? current.kds
                    : key === 'inventory'
                      ? current.inventory
                      : key === 'support'
                        ? current.support
                        : current.webOrdering
              }
            />
          ))}
          <CompareRow
            label="Paid trial"
            diff={diffs.paidTrial}
            newCell={
              <label className={styles.checkSm}>
                <input
                  type="checkbox"
                  checked={form.paidTrial}
                  onChange={e => {
                    const paidTrial = e.target.checked
                    if (paidTrial) {
                      patchForm({
                        paidTrial: true,
                        accessStartsEmpty: true,
                        accessStartsAt: '',
                      })
                    } else {
                      patchForm({
                        paidTrial: false,
                        paidTrialDays: '',
                      })
                    }
                  }}
                />
                {form.paidTrial ? 'Yes' : 'No'}
              </label>
            }
            currentCell={current.paidTrial}
          />
          <CompareRow
            label="Trial days"
            diff={diffs.trialDays}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={1}
                step={1}
                disabled={!form.paidTrial}
                value={form.paidTrialDays}
                onChange={e => patchForm({ paidTrialDays: e.target.value })}
              />
            }
            currentCell={current.trialDays}
          />
          <CompareRow
            label="Access starts"
            diff={diffs.accessStarts}
            newCell={
              <div className={styles.accessStack}>
                <label className={styles.checkSm}>
                  <input
                    type="checkbox"
                    checked={form.accessStartsEmpty}
                    disabled={form.paidTrial}
                    onChange={e =>
                      patchForm({
                        accessStartsEmpty: e.target.checked,
                        ...(e.target.checked ? { accessStartsAt: '' } : {}),
                      })
                    }
                  />
                  Immediate
                </label>
                <input
                  className={styles.inputAccess}
                  type="datetime-local"
                  min={accessMin}
                  disabled={form.paidTrial || form.accessStartsEmpty}
                  value={form.accessStartsAt}
                  onChange={e => {
                    const v = e.target.value
                    if (v && v < accessMin) {
                      setSaveError('Access starts cannot be before today')
                      return
                    }
                    patchForm({ accessStartsAt: v, accessStartsEmpty: false })
                  }}
                />
              </div>
            }
            currentCell={current.accessStarts}
          />
          <CompareRow
            label="Setup fee"
            diff={diffs.setupFee}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={form.paidTrial}
                value={form.setupFee}
                onChange={e => patchForm({ setupFee: e.target.value })}
              />
            }
            currentCell={current.setupFee}
          />
          <CompareRow
            label="Pre-trial setup"
            diff={diffs.preTrial}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={!form.paidTrial}
                value={form.preTrialSetupFee}
                onChange={e => patchForm({ preTrialSetupFee: e.target.value })}
              />
            }
            currentCell={current.preTrial}
          />
          <CompareRow
            label="Post-trial setup"
            diff={diffs.postTrial}
            newCell={
              <input
                className={styles.inputSm}
                type="number"
                min={0}
                step="any"
                disabled={!form.paidTrial}
                value={form.postTrialSetupFee}
                onChange={e =>
                  patchForm({ postTrialSetupFee: e.target.value })
                }
              />
            }
            currentCell={current.postTrial}
          />
          <CompareRow
            label="Total setup fees paid"
            newCell={
              <span
                className={styles.mutedVal}
                title="Read-only Nest field setupFeePaidUsd — not sent on PUT"
              >
                {setupFeePaidUsd != null
                  ? fmtMoney(setupFeePaidUsd)
                  : '—'}
              </span>
            }
            currentCell={
              setupFeePaidUsd != null ? (
                <span title="Regular + pre-trial + post-trial setup already collected">
                  {fmtMoney(setupFeePaidUsd)}
                </span>
              ) : (
                <span className={styles.placeholderVal}>—</span>
              )
            }
          />
          <CompareRow
            label="Billing period"
            newCell={<span className={styles.mutedVal}>After activation</span>}
            currentCell={current.period}
          />
        </div>
      </div>

      {(notes.length > 0 || (subscription?.warnings?.length ?? 0) > 0) && (
        <div className={styles.notesBlock}>
          {notes.map((n, i) => (
            <span key={`n-${i}`} className={styles.noteChip}>
              {n}
            </span>
          ))}
          {(subscription?.warnings ?? []).map((w, i) => (
            <span key={`w-${i}`} className={styles.warnChip}>
              {w}
            </span>
          ))}
        </div>
      )}

      {saveError && (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      )}
      {savedMsg && !saveError && (
        <p className={styles.success} role="status">
          {savedMsg}
        </p>
      )}

      {cancelDialog && (
        <ConfirmModal
          title={cancelDialog.title}
          message={cancelDialog.message}
          confirmLabel={
            cancelDialog.force ? 'Cancel pending offer' : 'Cancel offer'
          }
          danger
          loading={isPending}
          onConfirm={() => executeCancelOffer(cancelDialog.force)}
          onClose={() => {
            if (!isPending) setCancelDialog(null)
          }}
        />
      )}
    </form>
  )
}
