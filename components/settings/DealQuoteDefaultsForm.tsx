'use client'

import { useState, useTransition } from 'react'
import { saveDealQuoteDefaults } from '@/lib/actions/settings'
import {
  normalizeQuotedSubscriptionForSave,
  totalMonthlyRecurring,
  numStr,
  parseOptNum,
  FEATURE_ADDONS,
  SAVE_FLASH_MS,
  DEFAULT_PAID_TRIAL_DAYS,
  type BillingCycle,
  type DealQuoteDefaults,
  type QuotedSubscription,
} from '@/lib/subscription-quote'
import styles from '@/app/(app)/settings/general.module.css'

interface Currency {
  value: string
  label: string
}

export default function DealQuoteDefaultsForm({
  initial,
  currencies,
}: {
  initial: DealQuoteDefaults
  currencies: Currency[]
}) {
  const [currency, setCurrency] = useState(initial.currency)
  const [cycle, setCycle] = useState<BillingCycle>(initial.billingCycle)
  const [sub, setSub] = useState<QuotedSubscription>({
    ...initial.subscription,
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function patchSub(partial: Partial<QuotedSubscription>) {
    setSub(prev => ({ ...prev, ...partial }))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await saveDealQuoteDefaults({
          currency,
          billingCycle: cycle,
          subscription: normalizeQuotedSubscriptionForSave(sub, cycle),
        })
        setSaved(true)
        setTimeout(() => setSaved(false), SAVE_FLASH_MS)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  const monthlyTotal = totalMonthlyRecurring({
    ...sub,
    billingCycle: cycle,
  })

  return (
    <form onSubmit={handleSave} className={styles.form}>
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Currency</label>
          <select
            className={styles.select}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          >
            {currencies.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            {!currencies.some(c => c.value === currency) && (
              <option value={currency}>{currency}</option>
            )}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Billing cycle</label>
          <select
            className={styles.select}
            value={cycle}
            onChange={e => setCycle(e.target.value as BillingCycle)}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Platform fee (base / month)</label>
        <input
          type="number"
          min={0}
          step="0.01"
          className={styles.input}
          value={numStr(sub.monthlyPrice)}
          onChange={e =>
            patchSub({ monthlyPrice: parseOptNum(e.target.value) })
          }
        />
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Setup fee</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className={styles.input}
            disabled={sub.paidTrial}
            value={numStr(sub.setupFee)}
            onChange={e =>
              patchSub({ setupFee: parseOptNum(e.target.value) })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Branches</label>
          <input
            type="number"
            min={0}
            className={styles.input}
            disabled={sub.locationsUnlimited}
            value={numStr(sub.locations)}
            onChange={e =>
              patchSub({ locations: parseOptNum(e.target.value) })
            }
          />
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Users</label>
          <input
            type="number"
            min={0}
            className={styles.input}
            disabled={sub.usersUnlimited}
            value={numStr(sub.users)}
            onChange={e => patchSub({ users: parseOptNum(e.target.value) })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Counters</label>
          <input
            type="number"
            min={0}
            className={styles.input}
            disabled={sub.countersUnlimited}
            value={numStr(sub.counters)}
            onChange={e =>
              patchSub({ counters: parseOptNum(e.target.value) })
            }
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Orders / month</label>
        <input
          type="number"
          min={0}
          className={styles.input}
          disabled={sub.ordersUnlimited}
          value={numStr(sub.ordersPerMonth)}
          onChange={e =>
            patchSub({ ordersPerMonth: parseOptNum(e.target.value) })
          }
        />
      </div>

      <p className={styles.sectionDesc} style={{ marginTop: 8 }}>
        Feature add-ons — monthly $ added to platform fee when enabled. Web
        ordering also stores a revenue % for month-end invoicing (Nest TBD).
      </p>

      {FEATURE_ADDONS.map(({ key, feeKey, label }) => (
        <div key={key} className={styles.field}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={sub[key]}
              onChange={e => {
                const on = e.target.checked
                patchSub({
                  [key]: on,
                  ...(on
                    ? {}
                    : key === 'webOrdering'
                      ? {
                          [feeKey]: null,
                          webOrderingRevenuePercent: null,
                        }
                      : { [feeKey]: null }),
                })
              }}
            />
            {label}
          </label>
          {sub[key] && (
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>{label} / mo ({currency})</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={styles.input}
                  value={numStr(sub[feeKey])}
                  onChange={e =>
                    patchSub({ [feeKey]: parseOptNum(e.target.value) })
                  }
                />
              </div>
              {key === 'webOrdering' && (
                <div className={styles.field}>
                  <label className={styles.label}>Revenue share (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className={styles.input}
                    value={numStr(sub.webOrderingRevenuePercent)}
                    onChange={e =>
                      patchSub({
                        webOrderingRevenuePercent: parseOptNum(e.target.value),
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className={styles.featureRow}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={sub.paidTrial}
            onChange={e => patchSub({ paidTrial: e.target.checked })}
          />
          Paid trial
        </label>
      </div>

      {sub.paidTrial && (
        <>
          <div className={styles.field}>
            <label className={styles.label}>Trial days</label>
            <input
              type="number"
              min={0}
              className={styles.input}
              value={numStr(sub.paidTrialDays)}
              onChange={e =>
                patchSub({ paidTrialDays: parseOptNum(e.target.value) })
              }
            />
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Pre-trial setup</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                value={numStr(sub.preTrialSetupFee)}
                onChange={e =>
                  patchSub({
                    preTrialSetupFee: parseOptNum(e.target.value),
                  })
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Post-trial setup</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                value={numStr(sub.postTrialSetupFee)}
                onChange={e =>
                  patchSub({
                    postTrialSetupFee: parseOptNum(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </>
      )}

      <p className={styles.sectionDesc}>
        Platform total / mo: {currency}{' '}
        {monthlyTotal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.saveBtn} disabled={isPending}>
        {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save deal defaults'}
      </button>
    </form>
  )
}
