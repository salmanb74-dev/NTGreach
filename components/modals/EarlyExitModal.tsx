'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import { updateLead } from '@/lib/actions/leads'
import styles from './modals.module.css'

interface EarlyExitModalProps {
  leadId:   string
  leadName: string
  onClose:  () => void
  onSaved:  () => void
}

export default function EarlyExitModal({ leadId, leadName, onClose, onSaved }: EarlyExitModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!reason.trim()) {
      setError('Please add a note explaining why this lead is an early exit.')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        await updateLead(leadId, {
          stage:       'early_exit',
          lost_reason: reason.trim(),
          closed_at:   new Date().toISOString(),
        })
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title="Mark as Early Exit" onClose={onClose} width={420}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
          </svg>
          {leadName}
        </div>

        <p className={styles.helpText}>
          For leads that didn&apos;t progress far enough to discuss pricing — went cold, wrong fit, no budget, etc.
          No financial values are needed here.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>
            Reason <span className={styles.required}>*</span>
          </label>
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Went cold after first call, not a good fit, no budget this year…"
            rows={4}
            autoFocus
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Mark as Early Exit'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
