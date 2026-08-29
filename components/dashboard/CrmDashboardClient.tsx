'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_CSS,
  type PipelineStage,
} from '@/lib/types'
import {
  DEFAULT_DASHBOARD_STAGES,
  loadDashboardStageFilter,
  saveDashboardStageFilter,
} from '@/lib/dashboard/stage-filter-storage'
import type { WeeklyLeadDatum } from '@/lib/dashboard/weekly-leads'
import {
  activityBreakdownForLeads,
  computeDashboardStats,
  computeWinRate,
  countActivitiesByType,
  countFieldTouchpoints,
  filterLeadsByStages,
  type DashboardActivity,
  type DashboardLead,
} from '@/lib/dashboard/stats'
import {
  buildQuarterlyPayments,
  pipelineValueInDisplay,
} from '@/lib/dashboard/deal-values'
import ActivitySixMonthBreakdown from '@/components/analytics/ActivitySixMonthBreakdown'
import LeadsOverTimeChart from '@/components/analytics/LeadsOverTimeChart'
import PipelineStageTable from '@/components/analytics/PipelineStageTable'
import QuarterlyPaymentsChart from '@/components/analytics/QuarterlyPaymentsChart'
import { formatCurrency } from '@/lib/currency'
import type { ExchangeRate } from '@/lib/currency'
import styles from '@/app/(app)/dashboard/dashboard.module.css'

interface Props {
  leads: DashboardLead[]
  activities: DashboardActivity[]
  meetings: { lead_id: string; created_at: string }[]
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
  const [selectedStages, setSelectedStages] = useState<Set<PipelineStage>>(
    () => new Set(DEFAULT_DASHBOARD_STAGES)
  )
  const [filtersReady, setFiltersReady] = useState(false)

  useEffect(() => {
    setSelectedStages(loadDashboardStageFilter())
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    saveDashboardStageFilter(selectedStages)
  }, [selectedStages, filtersReady])

  function toggleStage(stage: PipelineStage) {
    setSelectedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  function selectAllStages() {
    setSelectedStages(new Set(PIPELINE_STAGES))
  }

  function clearAllStages() {
    setSelectedStages(new Set())
  }

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
    () => activityBreakdownForLeads(activities, leadIds, meetings),
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

  return (
    <>
      <div className={styles.stageFilters}>
        <div className={styles.stageFiltersHeader}>
          <span className={styles.stageFiltersLabel}>Pipeline stages</span>
          <div className={styles.stageFilterActions}>
            <button
              type="button"
              className={styles.stageFilterAction}
              onClick={selectAllStages}
            >
              Select all
            </button>
            <button
              type="button"
              className={styles.stageFilterAction}
              onClick={clearAllStages}
            >
              Clear all
            </button>
          </div>
        </div>
        <div className={styles.stageFilterList}>
          {PIPELINE_STAGES.map(stage => {
            const cssKey = STAGE_CSS[stage]
            const checked = selectedStages.has(stage)
            return (
              <label
                key={stage}
                className={`${styles.stageFilterChip} ${checked ? styles.stageFilterChipOn : ''}`}
                style={{
                  ['--chip-bg' as string]: `var(--stage-${cssKey}-bg)`,
                  ['--chip-text' as string]: `var(--stage-${cssKey}-text)`,
                  ['--chip-border' as string]: `var(--stage-${cssKey}-border)`,
                }}
              >
                <input
                  type="checkbox"
                  className={styles.stageFilterInput}
                  checked={checked}
                  onChange={() => toggleStage(stage)}
                />
                {STAGE_LABELS[stage]}
              </label>
            )
          })}
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Leads</div>
          <div className={styles.statValue}>{stats.totalLeads}</div>
          <div className={styles.statSub}>{stats.activeLeads} active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Paid</div>
          <div className={`${styles.statValue} ${styles.statSuccess}`}>
            {stats.paymentReceived}
          </div>
          <div className={styles.statSub}>{stats.closedLost} lost</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabelRow}>
            <div className={styles.statLabel}>Win Rate</div>
            <span className={styles.scopeBadge}>All leads</span>
          </div>
          <div
            className={`${styles.statValue} ${
              winRate != null && winRate >= 100
                ? styles.statSuccess
                : winRate != null
                  ? styles.statWarning
                  : ''
            }`}
          >
            {winRate != null ? `${winRate}%` : '—'}
          </div>
          <div className={styles.statSub}>(paid + won) ÷ lost</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Site Visits</div>
          <div className={styles.statValue}>{siteVisitCount}</div>
          <div className={styles.statSub}>
            {fieldTouchpointCount} WhatsApp, calls &amp; visits
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pipeline Value</div>
          <div className={`${styles.statValue} ${styles.statLarge}`}>
            {formatCurrency(displayPipeline, selectedCurrency)}
          </div>
          <div className={styles.statSub}>Setup + 12 mo recurring · {selectedCurrency}</div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Pipeline</div>
          <div className={styles.chartContentScroll}>
            <PipelineStageTable rows={pipelineRows} />
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitleRow}>
            <div className={styles.chartTitle}>Leads Added — Last 16 Weeks</div>
            <span className={styles.scopeBadge}>All leads</span>
          </div>
          <div className={styles.chartPlot}>
            <LeadsOverTimeChart data={weeklyData} weeks={16} />
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>6-Month Activity Breakdown</div>
          <div className={styles.chartContentScroll}>
            <ActivitySixMonthBreakdown data={activityData} />
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Expected Payments by Quarter</div>
          <div className={styles.chartPlot}>
            <QuarterlyPaymentsChart data={quarterlyData} currency={selectedCurrency} />
          </div>
        </div>
      </div>
    </>
  )
}
