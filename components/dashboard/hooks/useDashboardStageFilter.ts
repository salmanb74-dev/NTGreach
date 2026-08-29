'use client'

import { useEffect, useState } from 'react'
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types'
import {
  DEFAULT_DASHBOARD_STAGES,
  loadDashboardStageFilter,
  saveDashboardStageFilter,
} from '@/lib/dashboard/stage-filter-storage'

export function useDashboardStageFilter() {
  const [selectedStages, setSelectedStages] = useState<Set<PipelineStage>>(
    () => new Set(DEFAULT_DASHBOARD_STAGES)
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSelectedStages(loadDashboardStageFilter())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    saveDashboardStageFilter(selectedStages)
  }, [selectedStages, ready])

  function toggleStage(stage: PipelineStage) {
    setSelectedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  return {
    selectedStages,
    selectAllStages: () => setSelectedStages(new Set(PIPELINE_STAGES)),
    clearAllStages: () => setSelectedStages(new Set()),
    toggleStage,
  }
}
