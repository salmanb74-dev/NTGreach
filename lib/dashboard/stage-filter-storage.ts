import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types'

const STORAGE_KEY = 'crm-dashboard-stage-filters'

/** Default selection: all stages except closed lost and early exit. */
export const DEFAULT_DASHBOARD_STAGES: PipelineStage[] = PIPELINE_STAGES.filter(
  s => s !== 'closed_lost' && s !== 'early_exit'
)

export function loadDashboardStageFilter(): Set<PipelineStage> {
  if (typeof window === 'undefined') {
    return new Set(DEFAULT_DASHBOARD_STAGES)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_DASHBOARD_STAGES)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(DEFAULT_DASHBOARD_STAGES)
    const valid = parsed.filter(
      (s): s is PipelineStage =>
        typeof s === 'string' && PIPELINE_STAGES.includes(s as PipelineStage)
    )
    if (!valid.length) return new Set(DEFAULT_DASHBOARD_STAGES)
    return new Set(valid)
  } catch {
    return new Set(DEFAULT_DASHBOARD_STAGES)
  }
}

export function saveDashboardStageFilter(stages: Set<PipelineStage>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...stages]))
}
