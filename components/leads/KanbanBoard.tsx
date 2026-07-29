'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateLeadStage } from '@/lib/actions/leads'
import {
  PIPELINE_STAGES, STAGE_LABELS, STAGE_CSS,
  type Lead, type PipelineStage
} from '@/lib/types'
import styles from './KanbanBoard.module.css'

// ─── Kanban Card ─────────────────────────────────────────────
function KanbanCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const initials = lead.contact_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={styles.card}>
      <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()} className={styles.cardLink}>
        <div className={styles.cardHeader}>
          <div className={styles.cardAvatar}>{initials}</div>
          <div>
            <div className={styles.cardName}>{lead.contact_name}</div>
            <div className={styles.cardCompany}>{lead.company_name}</div>
          </div>
        </div>
        {lead.city && (
          <div className={styles.cardMeta}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            {lead.city}
          </div>
        )}
      </Link>
    </div>
  )
}

// ─── Droppable Column Body ────────────────────────────────────
function DroppableColumnBody({ stage, leads }: { stage: PipelineStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}` })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.columnBody} ${isOver ? styles.columnBodyOver : ''}`}
      data-stage={stage}
    >
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        {leads.map(lead => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
      </SortableContext>
      {leads.length === 0 && (
        <div className={`${styles.emptyCol} ${isOver ? styles.emptyColOver : ''}`}>
          Drop here
        </div>
      )}
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────
function KanbanColumn({ stage, leads }: { stage: PipelineStage; leads: Lead[] }) {
  const cssKey = STAGE_CSS[stage]

  return (
    <div className={styles.column}>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </Link>
        </div>
      </div>
      <DroppableColumnBody stage={stage} leads={leads} />
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────
export default function KanbanBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const leadsByStage = PIPELINE_STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter(l => l.stage === stage)
    return acc
  }, {})

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function getStageFromOverId(overId: string): PipelineStage | null {
    // Dropped on a column droppable zone
    if (overId.startsWith('col-')) {
      const stage = overId.replace('col-', '') as PipelineStage
      return PIPELINE_STAGES.includes(stage) ? stage : null
    }
    // Dropped on another card — find that card's stage
    const lead = leads.find(l => l.id === overId)
    return lead?.stage ?? null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return
    const newStage = getStageFromOverId(over.id as string)
    if (!newStage) return

    const lead = leads.find(l => l.id === active.id)
    if (!lead || lead.stage === newStage) return

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: newStage } : l))

    try {
      await updateLeadStage(lead.id, newStage)
    } catch {
      // Revert on error
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: lead.stage } : l))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.board}>
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={leadsByStage[stage]}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead && <KanbanCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  )
}
