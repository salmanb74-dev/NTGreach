'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import { updateLead } from '@/lib/actions/leads'
import type { PipelineStage } from '@/lib/types'
import styles from './modals.module.css'

interface DealValueModalProps {
  leadId:   string
  leadName: string
  newStage: PipelineStage
  existingSetupFee?: number | null
  existingMrr?:      number | null
  currency:          string
  onClose:  () => void
  onSaved:  () => void
}

const STAGE_LABELS: Record<string, string> = {
  proposal_sent: 'Proposal Sent',
  negotiation:   'Negotiation',
  closed_won:    'Closed Won',
  closed_lost:   'Closed Lost',
}

export default function DealValueModal({
  leadId, leadName, newStage,
  existingSetupFee, existingMrr, currency,
  onClose, onSaved,
}: DealValueModalProps) {
  const [setupFee, setSetupFee] = useState(existingSetupFee?.toString() ?? '')
  const [mrr, setMrr] = useState(existingMrr?.toString() ?? '')
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [paymentDate, setPaymentDate] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isClosing  = newStage === 'closed_won' || newStage === 'closed_lost'
  const isLost     = newStage === 'closed_lost'

  async function handleSave() {
    if (isLost && !lostReason.trim()) {
      setError('Please add a note explaining why this deal was lost.')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        await updateLead(leadId, {
          stage:              newStage,
          quoted_setup_fee:   setupFee ? parseFloat(setupFee) : null,
          quoted_mrr:         mrr      ? parseFloat(mrr)      : null,
          payment_frequency:  frequency,
          payment_start_date: paymentDate ? new Date(paymentDate).toISOString() : null,
          closed_at:          isClosing   ? new Date().toISOString() : null,
          lost_reason:        isLost ? lostReason.trim() : null,
        })
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title={`Moving to ${STAGE_LABELS[newStage] ?? newStage}`} onClose={onClose} width={460}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
          </svg>
          {leadName}
        </div>

        <p className={styles.helpText}>
          Record the quoted deal value for pipeline tracking. Currency: <strong>{currency}</strong>
        </p>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.label}>
              Setup Fee ({currency}) <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              className={styles.input}
              value={setupFee}
              onChange={e => setSetupFee(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              Recurring Fee ({currency}) <span className={styles.optional}>(optional)</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              className={styles.input}
              value={mrr}
              onChange={e => setMrr(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.label}>Recurring Frequency</label>
            <select
              className={styles.select}
              value={frequency}
              onChange={e => setFrequency(e.target.value as 'monthly' | 'annual')}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          {isClosing && (
            <div className={styles.field}>
              <label className={styles.label}>Payment Start Date</label>
              <input
                type="date"
                className={styles.input}
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {frequency === 'annual' && mrr && (
          <div className={styles.annualHint}>
            Annual amount: {currency} {(parseFloat(mrr) || 0).toLocaleString()} → MRR: {currency} {((parseFloat(mrr) || 0) / 12).toFixed(2)}/month
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>
            {isLost ? 'Reason Lost' : 'Note'} {isLost && <span className={styles.required}>*</span>}
            {!isLost && <span className={styles.optional}>(optional)</span>}
          </label>
          <textarea
            className={styles.textarea}
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            placeholder={isLost
              ? 'e.g. Went with a competitor, budget cut, project cancelled…'
              : 'Any additional context…'}
            rows={3}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save & Move Stage'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
