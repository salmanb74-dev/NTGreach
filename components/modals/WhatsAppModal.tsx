'use client'

import { useState } from 'react'
import { useTransition } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import { logWhatsApp } from '@/lib/actions/activities'
import styles from './modals.module.css'

interface WhatsAppModalProps {
  leadId: string
  leadName: string
  onClose: () => void
  onSaved: () => void
}

export default function WhatsAppModal({ leadId, leadName, onClose, onSaved }: WhatsAppModalProps) {
  const [body, setBody] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => {
    // Default to now in local datetime-local format
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!body.trim()) { setError('Please enter a summary.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await logWhatsApp(leadId, body.trim(), new Date(occurredAt).toISOString())
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title="Log WhatsApp Conversation" onClose={onClose} width={460}>
      <div className={styles.form}>
        <div className={styles.leadTag}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {leadName}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Date & Time</label>
          <input
            type="datetime-local"
            className={styles.input}
            value={occurredAt}
            onChange={e => setOccurredAt(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Summary *</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            placeholder="Summarise the WhatsApp conversation — key points, decisions, follow-ups…"
            autoFocus
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          <div />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}
              style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
              {isPending ? 'Saving…' : 'Save Note'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
