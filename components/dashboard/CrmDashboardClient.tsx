'use client'

import DashboardChartsGrid from '@/components/dashboard/DashboardChartsGrid'
import DashboardStageFilters from '@/components/dashboard/DashboardStageFilters'
import DashboardStatCards from '@/components/dashboard/DashboardStatCards'
import { useDashboardMetrics } from '@/components/dashboard/hooks/useDashboardMetrics'
import { useDashboardStageFilter } from '@/components/dashboard/hooks/useDashboardStageFilter'
import type {
  DashboardActivity,
  DashboardLead,
  DashboardMeeting,
} from '@/lib/dashboard/types'
import type { WeeklyLeadDatum } from '@/lib/dashboard/weekly-leads'
import type { ExchangeRate } from '@/lib/currency'

interface Props {
  leads: DashboardLead[]
  activities: DashboardActivity[]
  meetings: DashboardMeeting[]
  weeklyData: WeeklyLeadDatum[]
  inputCurrency: string
  selectedCurrency: string
  rates: ExchangeRate[]
}

export default function CrmDashboardClient({
  leads,
  activities,
  meetings,
  weeklyData,
  inputCurrency,
  selectedCurrency,
  rates,
}: Props) {
  const {
    selectedStages,
    selectAllStages,
    clearAllStages,
    toggleStage,
  } = useDashboardStageFilter()

  const metrics = useDashboardMetrics({
    leads,
    activities,
    meetings,
    selectedStages,
    inputCurrency,
    selectedCurrency,
    rates,
  })

  return (
    <>
      <DashboardStageFilters
        selectedStages={selectedStages}
        onToggle={toggleStage}
        onSelectAll={selectAllStages}
        onClearAll={clearAllStages}
      />
      <DashboardStatCards
        stats={metrics.stats}
        winRate={metrics.winRate}
        siteVisitCount={metrics.siteVisitCount}
        fieldTouchpointCount={metrics.fieldTouchpointCount}
        displayPipeline={metrics.displayPipeline}
        selectedCurrency={selectedCurrency}
      />
      <DashboardChartsGrid
        pipelineRows={metrics.pipelineRows}
        weeklyData={weeklyData}
        activityData={metrics.activityData}
        quarterlyData={metrics.quarterlyData}
        selectedCurrency={selectedCurrency}
      />
    </>
  )
}
