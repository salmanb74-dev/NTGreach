'use client'

import { useState } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import styles from './modals.module.css'

interface EmailModalProps {
  leadId: string
  toEmail: string
  toName: string
  onClose: () => void
  onSent: () => void
}

const SIGNATURE = `\n\n---\nBest regards,\nUmair Khan\nNTG Reach · NTG Clarity Networks\n\n⚠ Please reply to this email using the Reply button so your response is captured by our system.`

export default function EmailModal({ leadId, toEmail, toName, onClose, onSent }: EmailModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(SIGNATURE)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.')
      return
    }
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, to: toEmail, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSent()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="New Email" onClose={onClose} width={560}>
      <div className={styles.form}>
        {/* To field — read only */}
        <div className={styles.composeRow}>
          <span className={styles.composeLabel}>To</span>
          <span className={styles.composeValue}>{toName} &lt;{toEmail}&gt;</span>
        </div>

        {/* Reply-To hint */}
        <div className={styles.composeRow}>
          <span className={styles.composeLabel}>Reply-To</span>
          <span className={styles.composeValueMuted}>lead-{leadId.slice(0, 8)}…@mail.ntgclarity.com</span>
        </div>

        <div className={styles.divider} />

        {/* Subject */}
        <div className={styles.field}>
          <label className={styles.label}>Subject *</label>
          <input
            className={styles.input}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. NTG Reach — Demo this week?"
            autoFocus
          />
        </div>

        {/* Body */}
        <div className={styles.field}>
          <label className={styles.label}>Message *</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            placeholder="Write your message…"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          <span className={styles.hint}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            Sent via Mailjet · Replies auto-captured
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sending}>
              {sending ? 'Sending…' : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>
                  </svg>
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
