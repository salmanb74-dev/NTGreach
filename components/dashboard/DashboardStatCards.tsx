'use client'

import { formatCurrency } from '@/lib/currency'
import styles from './dashboard.module.css'

interface Stats {
  totalLeads: number
  activeLeads: number
  paymentReceived: number
  closedLost: number
}

interface Props {
  stats: Stats
  winRate: number | null
  siteVisitCount: number
  fieldTouchpointCount: number
  displayPipeline: number
  selectedCurrency: string
}

export default function DashboardStatCards({
  stats,
  winRate,
  siteVisitCount,
  fieldTouchpointCount,
  displayPipeline,
  selectedCurrency,
}: Props) {
  return (
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
  )
}
