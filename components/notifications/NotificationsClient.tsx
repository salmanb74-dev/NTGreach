'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { dismissReminder, deleteReminder } from '@/lib/actions/reminders'
import CreateReminderModal from '@/components/modals/CreateReminderModal'
import styles from './NotificationsClient.module.css'

const ACTIVITY_LABELS: Record<string, string> = {
  email:    '✉ Email',
  whatsapp: '💬 WhatsApp',
  call:     '📞 Call',
  visit:    '📍 Site Visit',
  other:    '📝 Other',
}

interface Lead { id: string; contact_name: string; company_name: string }

interface Reminder {
  id:            string
  note:          string
  activity_type: string | null
  remind_at:     string
  dismissed_at:  string | null
  leads:         Lead | null
}

interface Props {
  due:       Reminder[]
  upcoming:  Reminder[]
  dismissed: Reminder[]
  leads:     Lead[]
}

function ReminderCard({
  reminder, isDue, isDismissed, onDismiss, onDelete, isPending,
}: {
  reminder:    Reminder
  isDue:       boolean
  isDismissed: boolean
  onDismiss:   (id: string) => void
  onDelete:    (id: string) => void
  isPending:   boolean
}) {
  const lead     = reminder.leads as Lead | null
  const remindAt = new Date(reminder.remind_at)

  return (
    <div className={`${styles.card} ${isDue ? styles.cardDue : ''} ${isDismissed ? styles.cardDismissed : ''}`}>
      <div className={styles.cardLeft}>
        {isDue       && <span className={styles.dueBadge}>Due</span>}
        {isDismissed && <span className={styles.dismissedBadge}>Dismissed</span>}
        {reminder.activity_type && (
          <span className={styles.typeBadge}>
            {ACTIVITY_LABELS[reminder.activity_type] ?? reminder.activity_type}
          </span>
        )}
        <p className={styles.note}>{reminder.note}</p>
        {lead && (
          <Link href={`/leads/${lead.id}`} className={styles.leadLink}>
            {lead.contact_name} · {lead.company_name}
          </Link>
        )}
        <span className={styles.time}>
          {remindAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' at '}
          {remindAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className={styles.cardActions}>
        {isDue && (
          <button
            className={styles.dismissBtn}
            onClick={() => onDismiss(reminder.id)}
            disabled={isPending}
          >
            Dismiss
          </button>
        )}
        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(reminder.id)}
          disabled={isPending}
          title="Delete reminder"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3-3h6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function NotificationsClient({ due, upcoming, dismissed, leads }: Props) {
  const router = useRouter()
  const [showModal,     setShowModal]     = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)
  const [isPending, startTransition]      = useTransition()

  function handleDismiss(id: string) {
    startTransition(async () => {
      await dismissReminder(id)
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteReminder(id)
      router.refresh()
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          {due.length > 0 && (
            <span className={styles.dueCount}>{due.length} due</span>
          )}
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          + New Reminder
        </button>
      </div>

      {/* Due */}
      {due.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Due Now</div>
          {due.map(r => (
            <ReminderCard key={r.id} reminder={r} isDue isDismissed={false}
              onDismiss={handleDismiss} onDelete={handleDelete} isPending={isPending} />
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Upcoming</div>
          {upcoming.map(r => (
            <ReminderCard key={r.id} reminder={r} isDue={false} isDismissed={false}
              onDismiss={handleDismiss} onDelete={handleDelete} isPending={isPending} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {due.length === 0 && upcoming.length === 0 && (
        <div className={styles.empty}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <div className={styles.emptyText}>No reminders</div>
          <div className={styles.emptyHint}>Set a reminder to follow up on a lead</div>
        </div>
      )}

      {/* Dismissed toggle */}
      {dismissed.length > 0 && (
        <div className={styles.section}>
          <button
            className={styles.toggleDismissed}
            onClick={() => setShowDismissed(p => !p)}
          >
            {showDismissed ? '▲ Hide' : '▼ Show'} dismissed ({dismissed.length})
          </button>
          {showDismissed && dismissed.map(r => (
            <ReminderCard key={r.id} reminder={r} isDue={false} isDismissed
              onDismiss={handleDismiss} onDelete={handleDelete} isPending={isPending} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateReminderModal
          leads={leads}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </div>
  )
}
