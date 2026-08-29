'use client'

import { useMemo } from 'react'
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types'
import { buildSixMonthActivityBreakdown } from '@/lib/dashboard/activity-breakdown'
import {
  countActivitiesByType,
  countFieldTouchpoints,
} from '@/lib/dashboard/activity-stats'
import {
  buildQuarterlyPayments,
  pipelineValueInDisplay,
} from '@/lib/dashboard/deal-values'
import {
  computeDashboardStats,
  computeWinRate,
  filterLeadsByStages,
} from '@/lib/dashboard/stats'
import type {
  DashboardActivity,
  DashboardLead,
  DashboardMeeting,
} from '@/lib/dashboard/types'
import type { ExchangeRate } from '@/lib/currency'

interface Params {
  leads: DashboardLead[]
  activities: DashboardActivity[]
  meetings: DashboardMeeting[]
  selectedStages: Set<PipelineStage>
  inputCurrency: string
  selectedCurrency: string
  rates: ExchangeRate[]
}

export function useDashboardMetrics({
  leads,
  activities,
  meetings,
  selectedStages,
  inputCurrency,
  selectedCurrency,
  rates,
}: Params) {
  const filteredLeads = useMemo(
    () => filterLeadsByStages(leads, selectedStages),
    [leads, selectedStages]
  )

  const leadIds = useMemo(
    () => new Set(filteredLeads.map(l => l.id)),
    [filteredLeads]
  )

  const stats = useMemo(
    () => computeDashboardStats(filteredLeads),
    [filteredLeads]
  )

  const winRate = useMemo(() => computeWinRate(leads), [leads])

  const pipelineRows = useMemo(
    () =>
      PIPELINE_STAGES.filter(s => selectedStages.has(s)).map(stage => ({
        stage,
        count: stats.counts[stage] ?? 0,
      })),
    [selectedStages, stats.counts]
  )

  const activityData = useMemo(
    () => buildSixMonthActivityBreakdown(activities, leadIds, meetings),
    [activities, leadIds, meetings]
  )

  const siteVisitCount = useMemo(
    () => countActivitiesByType(activities, leadIds, 'site_visit'),
    [activities, leadIds]
  )

  const fieldTouchpointCount = useMemo(
    () => countFieldTouchpoints(activities, leadIds),
    [activities, leadIds]
  )

  const displayPipeline = useMemo(
    () =>
      pipelineValueInDisplay(
        filteredLeads,
        inputCurrency,
        selectedCurrency,
        rates
      ),
    [filteredLeads, inputCurrency, selectedCurrency, rates]
  )

  const quarterlyData = useMemo(
    () =>
      buildQuarterlyPayments(
        filteredLeads,
        inputCurrency,
        selectedCurrency,
        rates
      ),
    [filteredLeads, inputCurrency, selectedCurrency, rates]
  )

  return {
    stats,
    winRate,
    pipelineRows,
    activityData,
    siteVisitCount,
    fieldTouchpointCount,
    displayPipeline,
    quarterlyData,
  }
}
