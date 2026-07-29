import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_CSS, type PipelineStage } from '@/lib/types'
import FunnelChart from '@/components/analytics/FunnelChart'
import LeadsOverTimeChart from '@/components/analytics/LeadsOverTimeChart'
import ActivityBreakdown from '@/components/analytics/ActivityBreakdown'
import ConversionStats from '@/components/analytics/ConversionStats'
import CurrencySwitcher from '@/components/ui/CurrencySwitcher'
import { convertAmount, formatCurrency } from '@/lib/currency'
import { getAppSettings, getCurrentRates, getCachedProfile } from '@/lib/dataCache'
import styles from './dashboard.module.css'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { currency?: string }
}) {
  const supabase      = createClient()
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  // ── Parallel fetch — user/settings/rates from cache ──────────
  const [
    profile,
    settingsMap,
    ratesList,
    { data: allLeads },
    { data: activities },
    { count: meetingCount },
    { count: emailCount },
  ] = await Promise.all([
    getCachedProfile(),
    getAppSettings(),
    getCurrentRates(),
    supabase.from('leads').select(
      'id, stage, created_at, source, quoted_setup_fee, quoted_mrr, payment_frequency'
    ),
    supabase.from('activities').select('type'),
    supabase.from('meetings').select('*', { count: 'exact', head: true }),
    supabase.from('emails').select('*', { count: 'exact', head: true }),
  ])

  const userName = profile?.full_name ?? profile?.email ?? 'User'

  // ── Currency ───────────────────────────────────────────────
  const inputCurrency  = settingsMap['input_currency']  ?? 'PKR'
  const viewCurrencies = (settingsMap['view_currencies'] ?? inputCurrency).split(',').map(c => c.trim())
  const selectedCurrency = searchParams.currency && viewCurrencies.includes(searchParams.currency)
    ? searchParams.currency
    : viewCurrencies[0]

  function toDisplay(amount: number) {
    return convertAmount(amount, inputCurrency, selectedCurrency, ratesList)
  }

  // ── Stage counts ───────────────────────────────────────────
  const countsByStage: Record<string, number> = {}
  PIPELINE_STAGES.forEach(s => { countsByStage[s] = 0 })
  ;(allLeads ?? []).forEach(l => {
    if (l.stage) countsByStage[l.stage] = (countsByStage[l.stage] || 0) + 1
  })

  const totalLeads = allLeads?.length ?? 0
  const closedWon  = countsByStage['closed_won']  ?? 0
  const closedLost = countsByStage['closed_lost'] ?? 0
  const winRate    = (closedWon + closedLost) > 0
    ? Math.round((closedWon / (closedWon + closedLost)) * 100)
    : 0
  const activeLeads = totalLeads - closedWon - closedLost

  // ── Pipeline value ─────────────────────────────────────────
  const ACTIVE_STAGES = new Set(['new','contacted','demo_scheduled','proposal_sent','negotiation'])
  const pipelineValue = (allLeads ?? [])
    .filter(l => ACTIVE_STAGES.has(l.stage))
    .reduce((sum, l) => {
      const setup = l.quoted_setup_fee ?? 0
      const mrr   = l.payment_frequency === 'annual' ? (l.quoted_mrr ?? 0) / 12 : (l.quoted_mrr ?? 0)
      return sum + setup + mrr
    }, 0)

  // ── Weekly chart — reuse allLeads, filter by date ──────────
  const weekMap: Record<string, number> = {}
  ;(allLeads ?? [])
    .filter(l => new Date(l.created_at) >= eightWeeksAgo)
    .forEach(l => {
      const d    = new Date(l.created_at)
      const day  = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const mon  = new Date(d.setDate(diff))
      const key  = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      weekMap[key] = (weekMap[key] || 0) + 1
    })
  const weeklyData = Object.entries(weekMap).map(([week, count]) => ({ week, count }))

  // ── Activity breakdown ─────────────────────────────────────
  const activityCounts: Record<string, number> = {}
  ;(activities ?? []).forEach(a => {
    const key = a.type.includes('email')    ? 'Emails'
      : a.type.includes('whatsapp') ? 'WhatsApp'
      : a.type.includes('call')     ? 'Calls'
      : a.type.includes('meeting')  ? 'Meetings'
      : 'Notes'
    activityCounts[key] = (activityCounts[key] || 0) + 1
  })
  const activityData = Object.entries(activityCounts).map(([name, value]) => ({ name, value }))

  // ── Source breakdown ───────────────────────────────────────
  const sourceMap: Record<string, number> = {}
  ;(allLeads ?? []).forEach(l => {
    const s = l.source ?? 'other'
    sourceMap[s] = (sourceMap[s] || 0) + 1
  })
  const sourceData = Object.entries(sourceMap)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value)

  // ── Funnel ─────────────────────────────────────────────────
  const funnelStages: PipelineStage[] = ['new','contacted','demo_scheduled','proposal_sent','negotiation','closed_won']
  const funnelData = funnelStages.map(stage => ({
    stage:  STAGE_LABELS[stage],
    count:  countsByStage[stage] ?? 0,
    cssKey: STAGE_CSS[stage],
  }))

  const displayPipeline = toDisplay(pipelineValue)

  return (
    <>
      <Topbar title="Dashboard" userName={userName} />
      <div className={styles.page}>

        <CurrencySwitcher
          viewCurrencies={viewCurrencies}
          selected={selectedCurrency}
          rates={ratesList}
        />

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Leads</div>
            <div className={styles.statValue}>{totalLeads}</div>
            <div className={styles.statSub}>{activeLeads} active</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Closed Won</div>
            <div className={`${styles.statValue} ${styles.statSuccess}`}>{closedWon}</div>
            <div className={styles.statSub}>{closedLost} lost</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Win Rate</div>
            <div className={`${styles.statValue} ${winRate >= 50 ? styles.statSuccess : styles.statWarning}`}>
              {winRate}%
            </div>
            <div className={styles.statSub}>of closed deals</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Meetings</div>
            <div className={styles.statValue}>{meetingCount ?? 0}</div>
            <div className={styles.statSub}>{emailCount ?? 0} emails sent</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pipeline Value</div>
            <div className={`${styles.statValue} ${styles.statLarge}`}>
              {formatCurrency(displayPipeline, selectedCurrency)}
            </div>
            <div className={styles.statSub}>active leads · {selectedCurrency}</div>
          </div>
        </div>

        <div className={styles.row}>
          <div className={`${styles.chartCard} ${styles.chartFlex1}`}>
            <div className={styles.chartTitle}>Pipeline Funnel</div>
            <FunnelChart data={funnelData} />
          </div>
          <div className={`${styles.chartCard} ${styles.chartFlex14}`}>
            <div className={styles.chartTitle}>Leads Added — Last 8 Weeks</div>
            <LeadsOverTimeChart data={weeklyData} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={`${styles.chartCard} ${styles.chartFlex1}`}>
            <div className={styles.chartTitle}>Activity Breakdown</div>
            <ActivityBreakdown data={activityData} />
          </div>
          <div className={`${styles.chartCard} ${styles.chartFlex1}`}>
            <div className={styles.chartTitle}>Leads by Source</div>
            <ActivityBreakdown data={sourceData} />
          </div>
          <div className={`${styles.chartCard} ${styles.chartFlex1}`}>
            <div className={styles.chartTitle}>Stage Breakdown</div>
            <ConversionStats stages={PIPELINE_STAGES} counts={countsByStage} total={totalLeads} />
          </div>
        </div>

      </div>
    </>
  )
}
