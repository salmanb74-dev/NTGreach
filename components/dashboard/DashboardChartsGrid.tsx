'use client'

import ActivitySixMonthBreakdown from '@/components/analytics/ActivitySixMonthBreakdown'
import LeadsOverTimeChart from '@/components/analytics/LeadsOverTimeChart'
import PipelineStageTable, {
  type PipelineStageRow,
} from '@/components/analytics/PipelineStageTable'
import QuarterlyPaymentsChart from '@/components/analytics/QuarterlyPaymentsChart'
import type { SixMonthActivityBreakdown } from '@/lib/dashboard/activity-breakdown'
import type { QuarterPaymentDatum } from '@/lib/dashboard/deal-values'
import type { WeeklyLeadDatum } from '@/lib/dashboard/weekly-leads'
import styles from './dashboard.module.css'

interface Props {
  pipelineRows: PipelineStageRow[]
  weeklyData: WeeklyLeadDatum[]
  activityData: SixMonthActivityBreakdown
  quarterlyData: QuarterPaymentDatum[]
  selectedCurrency: string
}

export default function DashboardChartsGrid({
  pipelineRows,
  weeklyData,
  activityData,
  quarterlyData,
  selectedCurrency,
}: Props) {
  return (
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
  )
}
