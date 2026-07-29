'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import styles from './modals.module.css'

interface EmailLogModalProps {
  leadId:   string
  leadName: string
  onClose:  () => void
  onSaved:  () => void
}

export default function EmailLogModal({ leadId, leadName, onClose, onSaved }: EmailLogModalProps) {
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [subject,   setSubject]   = useState('')
  const [body,      setBody]      = useState('')
  const [emailDate, setEmailDate] = useState(new Date().toISOString().split('T')[0])
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!subject.trim()) {
      setError('Please add a subject line.')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error: dbError } = await supabase.from('activities').insert({
          lead_id:    leadId,
          type:       direction === 'outbound' ? 'email_outbound' : 'email_inbound',
          subject:    subject.trim(),
          body:       body.trim() || null,
          direction,
          created_by: user?.id,
          metadata:   { email_date: emailDate, manually_logged: true },
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
    <Modal title="Log Email" onClose={onClose} width={440}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          {leadName}
        </div>

        {/* Direction toggle */}
        <div className={styles.field}>
          <label className={styles.label}>Direction</label>
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${direction === 'outbound' ? styles.toggleActive : ''}`}
              onClick={() => setDirection('outbound')}
            >
              ↑ Sent
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${direction === 'inbound' ? styles.toggleActive : ''}`}
              onClick={() => setDirection('inbound')}
            >
              ↓ Received
            </button>
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.label}>Subject <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Re: NTG Reach demo follow-up"
              autoFocus
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Date</label>
          <input
            type="date"
            className={styles.input}
            value={emailDate}
            onChange={e => setEmailDate(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Summary <span className={styles.optional}>(optional)</span></label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Brief summary of what was discussed…"
            rows={3}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Log Email'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
