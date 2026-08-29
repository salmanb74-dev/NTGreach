'use client'

import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from '@/components/leads/kanban/KanbanCard'
import { columnId } from '@/components/leads/kanban/dnd'
import { STAGE_LABELS, STAGE_CSS, type Lead, type PipelineStage } from '@/lib/types'
import styles from '../KanbanBoard.module.css'

function KanbanColumnBody({
  stage,
  leads,
}: {
  stage: PipelineStage
  leads: Lead[]
}) {
  return (
    <div className={styles.columnBody} data-stage={stage}>
      <SortableContext
        items={leads.map(l => l.id)}
        strategy={verticalListSortingStrategy}
      >
        {leads.map(lead => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
      </SortableContext>
      {leads.length === 0 && (
        <div className={styles.emptyCol}>Drop here</div>
      )}
    </div>
  )
}

export default function KanbanColumn({
  stage,
  leads,
}: {
  stage: PipelineStage
  leads: Lead[]
}) {
  const cssKey = STAGE_CSS[stage]
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(stage),
    data: { type: 'column', stage },
  })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
    >
      <div className={styles.columnHeader}>
        <span className={styles.columnLabel}>{STAGE_LABELS[stage]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            className={styles.columnCount}
            style={{
              background: `var(--stage-${cssKey}-bg)`,
              color: `var(--stage-${cssKey}-text)`,
            }}
          >
            {leads.length}
          </span>
          <Link
            href={`/leads/new?stage=${stage}`}
            className={styles.addBtn}
            title={`Add lead to ${STAGE_LABELS[stage]}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </div>
      <KanbanColumnBody stage={stage} leads={leads} />
    </div>
  )
}
