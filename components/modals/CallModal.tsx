'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import { logCall } from '@/lib/actions/activities'
import styles from './modals.module.css'

const OUTCOMES = [
  'Positive — follow up needed',
  'Interested — send proposal',
  'Not interested',
  'No answer',
  'Left voicemail',
  'Wrong number',
  'Call back requested',
]

interface CallModalProps {
  leadId: string
  leadName: string
  onClose: () => void
  onSaved: () => void
}

export default function CallModal({ leadId, leadName, onClose, onSaved }: CallModalProps) {
  const [duration, setDuration] = useState('')
  const [outcome, setOutcome] = useState(OUTCOMES[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await logCall(leadId, parseInt(duration) || 0, outcome, notes.trim())
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title="Log Call" onClose={onClose} width={440}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          {leadName}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.label}>Duration (minutes)</label>
            <input
              type="number"
              min="0"
              className={styles.input}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="15"
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Outcome</label>
            <select className={styles.select} value={outcome} onChange={e => setOutcome(e.target.value)}>
              {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Key points from the call — what was discussed, next steps…"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          <div />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Call'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
