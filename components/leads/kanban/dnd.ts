import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import { PIPELINE_STAGES, type Lead, type PipelineStage } from '@/lib/types'

export function columnId(stage: PipelineStage) {
  return `col-${stage}`
}

export function getStageFromOverId(
  overId: string,
  leads: Lead[]
): PipelineStage | null {
  if (overId.startsWith('col-')) {
    const stage = overId.slice(4) as PipelineStage
    return PIPELINE_STAGES.includes(stage) ? stage : null
  }
  const lead = leads.find(l => l.id === overId)
  return (lead?.stage as PipelineStage | undefined) ?? null
}

export function resolveOverStage(
  over: { id: string | number; data: { current?: unknown } },
  leads: Lead[]
): PipelineStage | null {
  const data = over.data.current as
    | { type?: string; stage?: PipelineStage }
    | undefined
  if (data?.stage && PIPELINE_STAGES.includes(data.stage)) return data.stage
  return getStageFromOverId(String(over.id), leads)
}

export const collisionDetection: CollisionDetection = args => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return rectIntersection(args)
}
