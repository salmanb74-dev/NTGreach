'use client'

import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { initialsFromName } from '@/lib/format/initials'
import type { Lead } from '@/lib/types'
import styles from '../KanbanBoard.module.css'

function LocationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CardBody({ lead }: { lead: Lead }) {
  const initials = initialsFromName(lead.contact_name)

  return (
    <div className={styles.cardLink}>
      <div className={styles.cardHeader}>
        <div className={styles.cardAvatar}>{initials}</div>
        <div>
          <div className={styles.cardName}>{lead.contact_name}</div>
          <div className={styles.cardCompany}>{lead.company_name}</div>
        </div>
      </div>
      {lead.city && (
        <div className={styles.cardMeta}>
          <LocationIcon />
          {lead.city}
        </div>
      )}
    </div>
  )
}

export function KanbanCardPreview({ lead }: { lead: Lead }) {
  return (
    <div className={`${styles.card} ${styles.cardOverlay}`}>
      <CardBody lead={lead} />
    </div>
  )
}

export default function KanbanCard({ lead }: { lead: Lead }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: 'lead', stage: lead.stage } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={styles.card}
    >
      <button
        type="button"
        className={styles.dragHandle}
        {...listeners}
        aria-label={`Drag ${lead.contact_name}`}
        onClick={e => e.preventDefault()}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.2" />
          <circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="7" r="1.2" />
          <circle cx="6" cy="7" r="1.2" />
          <circle cx="2" cy="12" r="1.2" />
          <circle cx="6" cy="12" r="1.2" />
        </svg>
      </button>
      <Link
        href={`/leads/${lead.id}`}
        className={styles.cardLink}
        draggable={false}
      >
        <CardBody lead={lead} />
      </Link>
    </div>
  )
}
