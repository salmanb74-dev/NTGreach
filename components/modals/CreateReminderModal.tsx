'use client'

import { useState, useTransition, useEffect } from 'react'
import Modal from './Modal'
import Button from '@/components/ui/Button'
import { createReminder } from '@/lib/actions/reminders'
import styles from './modals.module.css'

interface Lead { id: string; contact_name: string; company_name: string }

interface CreateReminderModalProps {
  onClose:   () => void
  onSaved:   () => void
  leads?:    Lead[]
  defaultLeadId?: string
}

const ACTIVITY_TYPES = [
  { value: 'email',    label: '✉ Send Email'      },
  { value: 'whatsapp', label: '💬 WhatsApp'        },
  { value: 'call',     label: '📞 Call'            },
  { value: 'visit',    label: '📍 Site Visit'      },
  { value: 'other',    label: '📝 Other'           },
]

export default function CreateReminderModal({
  onClose, onSaved, leads = [], defaultLeadId,
}: CreateReminderModalProps) {
  const [leadId,       setLeadId]       = useState(defaultLeadId ?? '')
  const [activityType, setActivityType] = useState('')
  const [note,         setNote]         = useState('')
  const [remindDate,   setRemindDate]   = useState('')
  const [remindTime,   setRemindTime]   = useState('09:00')
  const [error,        setError]        = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()

  // Default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setRemindDate(tomorrow.toISOString().split('T')[0])
  }, [])

  function handleSave() {
    if (!note.trim()) { setError('Please add a note.'); return }
    if (!remindDate)  { setError('Please set a reminder date.'); return }
    setError(null)

    const remindAt = new Date(`${remindDate}T${remindTime}:00`).toISOString()

    startTransition(async () => {
      try {
        await createReminder({
          lead_id:       leadId || null,
          activity_type: activityType || undefined,
          note:          note.trim(),
          remind_at:     remindAt,
        })
        onSaved()
        onClose()
      } catch (err: any) {
        setError(err.message ?? 'Failed to save.')
      }
    })
  }

  return (
    <Modal title="Set Reminder" onClose={onClose} width={440}>
      <div className={styles.form}>

        {leads.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>Lead <span className={styles.optional}>(optional)</span></label>
            <select
              className={styles.select}
              value={leadId}
              onChange={e => setLeadId(e.target.value)}
            >
              <option value="">No specific lead</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>
                  {l.contact_name} — {l.company_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Activity Type <span className={styles.optional}>(optional)</span></label>
          <select
            className={styles.select}
            value={activityType}
            onChange={e => setActivityType(e.target.value)}
          >
            <option value="">Select type…</option>
            {ACTIVITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Note <span className={styles.required}>*</span></label>
          <textarea
            className={styles.textarea}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Follow up on proposal, Call to check decision…"
            rows={3}
            autoFocus
          />
        </div>

        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label className={styles.label}>Date <span className={styles.required}>*</span></label>
            <input
              type="date"
              className={styles.input}
              value={remindDate}
              onChange={e => setRemindDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            <input
              type="time"
              className={styles.input}
              value={remindTime}
              onChange={e => setRemindTime(e.target.value)}
            />
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footerSimple}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Set Reminder'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
