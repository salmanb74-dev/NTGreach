'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLead } from '@/lib/actions/leads'
import {
  monthsForBillingCycle,
  hydrateQuotedSubscriptionFromLead,
  normalizeQuotedSubscriptionForSave,
  totalMonthlyRecurring,
  estimateFirstPaymentBase,
  numStr,
  parseOptNum,
  FEATURE_ADDONS,
  SAVE_FLASH_MS,
  DEFAULT_PAID_TRIAL_DAYS,
  type BillingCycle,
  type QuotedSubscription,
} from '@/lib/subscription-quote'
import styles from './DealPanel.module.css'

interface Currency {
  value: string
  label: string
}

interface DealPanelProps {
  leadId: string
  dealCurrency: string | null
  setupFee: number | null
  recurringFee: number | null
  frequency: 'monthly' | 'annual' | null
  discount: number | null
  taxRate: number | null
  paymentStartDate: string | null
  quotedSubscription: unknown
  currencies: Currency[]
  inputCurrency: string
}

export default function DealPanel({
  leadId,
  dealCurrency,
  setupFee,
  recurringFee,
  frequency,
  discount,
  taxRate,
  paymentStartDate,
  quotedSubscription,
  currencies,
  inputCurrency,
}: DealPanelProps) {
  const router = useRouter()
  const initialSub = hydrateQuotedSubscriptionFromLead({
    quoted_subscription: quotedSubscription,
    quoted_mrr: recurringFee,
    quoted_setup_fee: setupFee,
    payment_frequency: frequency,
  })

  const [currency, setCurrency] = useState(dealCurrency ?? inputCurrency)
  const [disc, setDisc] = useState(discount?.toString() ?? '')
  const [tax, setTax] = useState(taxRate?.toString() ?? '')
  const [payDate, setPayDate] = useState(
    paymentStartDate ? paymentStartDate.split('T')[0] : ''
  )
  const [sub, setSub] = useState<QuotedSubscription>(initialSub)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(
    !!(setupFee || recurringFee || initialSub.monthlyPrice)
  )

  const monthly = totalMonthlyRecurring(sub)
  const baseMonthly = sub.monthlyPrice ?? 0
  const cycle = sub.billingCycle
  const discNum = parseFloat(disc) || 0
  const taxNum = parseFloat(tax) || 0
  const { setupFees, total: firstBase } = estimateFirstPaymentBase(sub)
  const subtotal = firstBase - discNum
  const totalFirst = subtotal + (subtotal * taxNum) / 100

  function patchSub(partial: Partial<QuotedSubscription>) {
    setSub(prev => ({ ...prev, ...partial }))
  }

  function handleSave() {
    setError(null)
    const payload = normalizeQuotedSubscriptionForSave(sub, sub.billingCycle)

    startTransition(async () => {
      try {
        await updateLead(leadId, {
          deal_currency: currency,
          quoted_setup_fee: payload.setupFee,
          quoted_mrr: totalMonthlyRecurring(payload),
          payment_frequency: payload.billingCycle,
          discount: disc ? parseFloat(disc) : null,
          tax_rate: tax ? parseFloat(tax) : null,
          payment_start_date: payDate
            ? new Date(payDate).toISOString()
            : null,
          quoted_subscription: payload,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), SAVE_FLASH_MS)
        router.refresh()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save.')
      }
    })
  }

  function LimitField({
    label,
    value,
    unlimited,
    onValue,
    onUnlimited,
  }: {
    label: string
    value: number | null
    unlimited: boolean
    onValue: (n: number | null) => void
    onUnlimited: (u: boolean) => void
  }) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        <div className={styles.limitRow}>
          <input
            type="number"
            min={0}
            className={styles.input}
            disabled={unlimited}
            value={unlimited ? '' : numStr(value)}
            onChange={e => onValue(parseOptNum(e.target.value))}
            placeholder={unlimited ? 'Unlimited' : '0'}
          />
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={unlimited}
              onChange={e => onUnlimited(e.target.checked)}
            />
            Unlimited
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.header} onClick={() => setIsOpen(p => !p)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span className={styles.headerLabel}>Deal Values</span>
        {!isOpen && (sub.monthlyPrice != null || setupFee || recurringFee) ? (
          <span className={styles.headerSummary}>
            {currency}{' '}
            {(sub.monthlyPrice ?? recurringFee ?? 0).toLocaleString()}/mo
            {cycle === 'annual' ? ' · Annual' : ' · Monthly'}
          </span>
        ) : null}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.body}>
          <p className={styles.sectionHint}>
            Same commercial parameters as Ops Resto → Subscription. Used on
            quotations and contracts.
          </p>

          <div className={styles.sectionTitle}>Pricing</div>
          <div className={styles.field}>
            <label className={styles.label}>Currency</label>
            <select
              className={styles.select}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              {currencies.map(c => (
                <option key={c.value} value={c.value}>
                  {c.value} — {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Platform fee (per month)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                value={numStr(sub.monthlyPrice)}
                onChange={e =>
                  patchSub({ monthlyPrice: parseOptNum(e.target.value) })
                }
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Billing cycle</label>
              <select
                className={styles.select}
                value={sub.billingCycle}
                onChange={e => {
                  const next = e.target.value as BillingCycle
                  patchSub({
                    billingCycle: next,
                    durationMonths: monthsForBillingCycle(next),
                  })
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div className={styles.sectionTitle}>Setup &amp; trial</div>
          <label className={styles.checkLabelBlock}>
            <input
              type="checkbox"
              checked={sub.paidTrial}
              onChange={e => patchSub({ paidTrial: e.target.checked })}
            />
            Paid trial
          </label>

          <div className={styles.twoCol}>
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
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Trial days</label>
              <input
                type="number"
                min={0}
                className={styles.input}
                disabled={!sub.paidTrial}
                value={numStr(sub.paidTrialDays)}
                onChange={e =>
                  patchSub({ paidTrialDays: parseOptNum(e.target.value) })
                }
                placeholder={String(DEFAULT_PAID_TRIAL_DAYS)}
              />
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Pre-trial setup</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                disabled={!sub.paidTrial}
                value={numStr(sub.preTrialSetupFee)}
                onChange={e =>
                  patchSub({ preTrialSetupFee: parseOptNum(e.target.value) })
                }
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Post-trial setup</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                disabled={!sub.paidTrial}
                value={numStr(sub.postTrialSetupFee)}
                onChange={e =>
                  patchSub({ postTrialSetupFee: parseOptNum(e.target.value) })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className={styles.sectionTitle}>Limits</div>
          <LimitField
            label="Branches"
            value={sub.locations}
            unlimited={sub.locationsUnlimited}
            onValue={n => patchSub({ locations: n })}
            onUnlimited={u => patchSub({ locationsUnlimited: u })}
          />
          <LimitField
            label="Users"
            value={sub.users}
            unlimited={sub.usersUnlimited}
            onValue={n => patchSub({ users: n })}
            onUnlimited={u => patchSub({ usersUnlimited: u })}
          />
          <LimitField
            label="Counters"
            value={sub.counters}
            unlimited={sub.countersUnlimited}
            onValue={n => patchSub({ counters: n })}
            onUnlimited={u => patchSub({ countersUnlimited: u })}
          />
          <LimitField
            label="Orders / month"
            value={sub.ordersPerMonth}
            unlimited={sub.ordersUnlimited}
            onValue={n => patchSub({ ordersPerMonth: n })}
            onUnlimited={u => patchSub({ ordersUnlimited: u })}
          />

          <div className={styles.sectionTitle}>Features (monthly add-ons)</div>
          <p className={styles.sectionHint}>
            Enable a feature to add its monthly $ to the platform fee. Web
            ordering also takes a % of revenue on the month-end invoice
            (Nest billing placeholder).
          </p>
          {FEATURE_ADDONS.map(({ key, feeKey, label }) => (
            <div key={key} className={styles.addonBlock}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
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
                <div className={styles.twoCol}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      {label} fee / mo ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={styles.input}
                      value={numStr(sub[feeKey])}
                      onChange={e =>
                        patchSub({ [feeKey]: parseOptNum(e.target.value) })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  {key === 'webOrdering' && (
                    <div className={styles.field}>
                      <label className={styles.label}>
                        Revenue share (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className={styles.input}
                        value={numStr(sub.webOrderingRevenuePercent)}
                        onChange={e =>
                          patchSub({
                            webOrderingRevenuePercent: parseOptNum(
                              e.target.value
                            ),
                          })
                        }
                        placeholder="e.g. 2.5"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {(monthly > 0 || baseMonthly > 0) && (
            <div className={styles.addonTotal}>
              Platform total / mo: {currency}{' '}
              {monthly.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {monthly !== baseMonthly ? (
                <span className={styles.addonTotalNote}>
                  {' '}
                  (base {baseMonthly.toLocaleString()} + add-ons)
                </span>
              ) : null}
            </div>
          )}

          <div className={styles.sectionTitle}>Billing extras</div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Trial starts</label>
              <input
                type="date"
                className={styles.input}
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Discount ({currency})</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={styles.input}
                value={disc}
                onChange={e => setDisc(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tax rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className={styles.input}
              value={tax}
              onChange={e => setTax(e.target.value)}
              placeholder="0"
            />
          </div>

          {(monthly > 0 || setupFees > 0) && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Est. total first payment</span>
              <span className={styles.totalValue}>
                {currency}{' '}
                {totalFirst.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="button"
            className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Deal Values'}
          </button>
        </div>
      )}
    </div>
  )
}