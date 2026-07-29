'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import styles from './modals.module.css'

interface SiteVisitModalProps {
  leadId:   string
  leadName: string
  onClose:  () => void
  onSaved:  () => void
}

const OUTCOMES = [
  'Positive — progressing',
  'Neutral — needs follow-up',
  'Demo given',
  'Requirements gathered',
  'Decision pending',
  'Not interested',
  'Other',
]

export default function SiteVisitModal({ leadId, leadName, onClose, onSaved }: SiteVisitModalProps) {
  const [visitDate, setVisitDate]     = useState(new Date().toISOString().split('T')[0])
  const [duration,  setDuration]      = useState('')
  const [outcome,   setOutcome]       = useState('')
  const [notes,     setNotes]         = useState('')
  const [error,     setError]         = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  function handleSave() {
    if (!notes.trim()) {
      setError('Please add a note about the visit.')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error: dbError } = await supabase.from('activities').insert({
          lead_id:          leadId,
          type:             'site_visit',
          subject:          `Site visit — ${visitDate}`,
          body:             notes.trim(),
          outcome:          outcome || null,
          duration_minutes: duration ? parseInt(duration) : null,
          created_by:       user?.id,
          metadata:         { visit_date: visitDate },
        })

        if (dbError) throw new Error(dbError.message)
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title="Log Site Visit" onClose={onClose} width={440}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {leadName}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.label}>Visit Date</label>
            <input
              type="date"
              className={styles.input}
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Duration (minutes)</label>
            <input
              type="number"
              min="1"
              className={styles.input}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Outcome</label>
          <select
            className={styles.select}
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
          >
            <option value="">Select outcome…</option>
            {OUTCOMES.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Notes <span className={styles.required}>*</span>
          </label>
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was discussed, who was present, next steps…"
            rows={4}
            autoFocus
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Log Visit'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
