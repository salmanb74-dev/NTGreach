'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import KanbanColumn from '@/components/leads/kanban/KanbanColumn'
import { KanbanCardPreview } from '@/components/leads/kanban/KanbanCard'
import { collisionDetection, resolveOverStage } from '@/components/leads/kanban/dnd'
import { updateLeadStage } from '@/lib/actions/leads'
import { PIPELINE_STAGES, type Lead, type PipelineStage } from '@/lib/types'
import styles from '../KanbanBoard.module.css'

export default function KanbanBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [stageAtDragStart, setStageAtDragStart] = useState<PipelineStage | null>(
    null
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  )

  const leadsByStage = PIPELINE_STAGES.reduce<Record<string, Lead[]>>(
    (acc, stage) => {
      acc[stage] = leads.filter(l => l.stage === stage)
      return acc
    },
    {}
  )

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    setActiveId(id)
    const lead = leads.find(l => l.id === id)
    setStageAtDragStart(lead?.stage ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeLeadId = active.id as string
    const overStage = resolveOverStage(over, leads)
    if (!overStage) return

    setLeads(prev => {
      const current = prev.find(l => l.id === activeLeadId)
      if (!current || current.stage === overStage) return prev
      return prev.map(l =>
        l.id === activeLeadId ? { ...l, stage: overStage } : l
      )
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const leadId = active.id as string
    const fromStage = stageAtDragStart

    setActiveId(null)
    setStageAtDragStart(null)

    if (!fromStage) return

    if (!over) {
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, stage: fromStage } : l))
      )
      return
    }

    const toStage = resolveOverStage(over, leads)
    if (!toStage || toStage === fromStage) {
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, stage: fromStage } : l))
      )
      return
    }

    setLeads(prev =>
      prev.map(l => (l.id === leadId ? { ...l, stage: toStage } : l))
    )

    try {
      await updateLeadStage(leadId, toStage)
    } catch {
      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, stage: fromStage } : l))
      )
    }
  }

  function handleDragCancel() {
    if (activeId && stageAtDragStart) {
      setLeads(prev =>
        prev.map(l =>
          l.id === activeId ? { ...l, stage: stageAtDragStart } : l
        )
      )
    }
    setActiveId(null)
    setStageAtDragStart(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
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

      <DragOverlay dropAnimation={null}>
        {activeLead ? <KanbanCardPreview lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
