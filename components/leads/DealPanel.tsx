'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateLead } from '@/lib/actions/leads'
import styles from './DealPanel.module.css'

interface Currency {
  value: string
  label: string
}

interface DealPanelProps {
  leadId:           string
  dealCurrency:     string | null
  setupFee:         number | null
  recurringFee:     number | null
  frequency:        'monthly' | 'annual' | null
  discount:         number | null
  taxRate:          number | null
  paymentStartDate: string | null
  currencies:       Currency[]
  inputCurrency:    string
}

function calcTotal(
  setup:     number,
  recurring: number,
  discount:  number,
  taxRate:   number
): number {
  const subtotal = setup + recurring - discount
  return subtotal + (subtotal * taxRate / 100)
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
  currencies,
  inputCurrency,
}: DealPanelProps) {
  const router = useRouter()
  const [currency,    setCurrency]    = useState(dealCurrency    ?? inputCurrency)
  const [setup,       setSetup]       = useState(setupFee?.toString()     ?? '')
  const [recurring,   setRecurring]   = useState(recurringFee?.toString() ?? '')
  const [freq,        setFreq]        = useState<'monthly' | 'annual'>(frequency ?? 'monthly')
  const [disc,        setDisc]        = useState(discount?.toString()  ?? '')
  const [tax,         setTax]         = useState(taxRate?.toString()   ?? '')
  const [payDate,     setPayDate]     = useState(
    paymentStartDate ? paymentStartDate.split('T')[0] : ''
  )
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()
  const [isOpen,      setIsOpen]      = useState(
    !!(setupFee || recurringFee) // open by default if values already exist
  )

  const setupNum     = parseFloat(setup)     || 0
  const recurringNum = parseFloat(recurring) || 0
  const discNum      = parseFloat(disc)      || 0
  const taxNum       = parseFloat(tax)       || 0
  const totalFirst   = calcTotal(setupNum, recurringNum, discNum, taxNum)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateLead(leadId, {
          deal_currency:      currency,
          quoted_setup_fee:   setup     ? parseFloat(setup)     : null,
          quoted_mrr:         recurring ? parseFloat(recurring) : null,
          payment_frequency:  freq,
          discount:           disc      ? parseFloat(disc)      : null,
          tax_rate:           tax       ? parseFloat(tax)       : null,
          payment_start_date: payDate   ? new Date(payDate).toISOString() : null,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        router.refresh()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <div className={styles.panel}>
      <button className={styles.header} onClick={() => setIsOpen(p => !p)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span className={styles.headerLabel}>Deal Values</span>
        {!isOpen && (setupFee || recurringFee) ? (
          <span className={styles.headerSummary}>
            {currency} {setupNum.toLocaleString()} + {recurringNum.toLocaleString()}/{freq === 'annual' ? 'yr' : 'mo'}
          </span>
        ) : null}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div className={styles.body}>
          {/* Currency */}
          <div className={styles.field}>
            <label className={styles.label}>Currency</label>
            <select className={styles.select} value={currency} onChange={e => setCurrency(e.target.value)}>
              {currencies.map(c => (
                <option key={c.value} value={c.value}>{c.value} — {c.label}</option>
              ))}
            </select>
          </div>

          {/* Setup + Recurring */}
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Setup Fee</label>
              <input
                type="number" min="0" step="0.01"
                className={styles.input}
                value={setup}
                onChange={e => setSetup(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Recurring Fee</label>
              <input
                type="number" min="0" step="0.01"
                className={styles.input}
                value={recurring}
                onChange={e => setRecurring(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Frequency + Start Date */}
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Frequency</label>
              <select className={styles.select} value={freq} onChange={e => setFreq(e.target.value as 'monthly' | 'annual')}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Payment Start</label>
              <input
                type="date"
                className={styles.input}
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>
          </div>

          {/* Discount + Tax */}
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label className={styles.label}>Discount ({currency})</label>
              <input
                type="number" min="0" step="0.01"
                className={styles.input}
                value={disc}
                onChange={e => setDisc(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Tax Rate (%)</label>
              <input
                type="number" min="0" max="100" step="0.1"
                className={styles.input}
                value={tax}
                onChange={e => setTax(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Total first payment */}
          {(setupNum > 0 || recurringNum > 0) && (
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total First Payment</span>
              <span className={styles.totalValue}>
                {currency} {totalFirst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {freq === 'annual' && recurringNum > 0 && (
            <div className={styles.hint}>
              MRR equivalent: {currency} {(recurringNum / 12).toFixed(2)}/month
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button
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
