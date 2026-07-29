import type { Target } from '@/lib/types'
import {
  convertAmount,
  convertAmountHistorical,
  hasHistoricalRate,
  type ExchangeRate,
  type ExchangeRateHistory,
} from '@/lib/currency'
import styles from './PerformanceReport.module.css'

interface Lead {
  id: string
  stage: string
  quoted_setup_fee: number | null
  quoted_mrr: number | null
  payment_frequency: string | null
  payment_start_date: string | null
  closed_at: string | null
  created_by: string | null
}

interface User {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  user:          User | undefined
  targets:       Target[]
  closedLeads:   Lead[]
  allLeads:      Lead[]
  currency:      string       // view currency selected by user
  inputCurrency: string       // system input currency (PKR)
  rates:         ExchangeRate[]
  rateHistory?:  ExchangeRateHistory[]
}

function getMRR(lead: Lead): number {
  if (!lead.quoted_mrr) return 0
  return lead.payment_frequency === 'annual' ? lead.quoted_mrr / 12 : lead.quoted_mrr
}

function getRevenueInPeriod(lead: Lead, startDate: Date, endDate: Date): number {
  if (!lead.payment_start_date) return 0
  const payStart = new Date(lead.payment_start_date)
  if (payStart > endDate) return 0
  const effectiveStart = payStart > startDate ? payStart : startDate
  const msInPeriod     = endDate.getTime() - effectiveStart.getTime()
  const monthsInPeriod = msInPeriod / (1000 * 60 * 60 * 24 * 30.44)
  const mrr            = getMRR(lead)
  const setupFee       = payStart >= startDate && payStart <= endDate ? (lead.quoted_setup_fee ?? 0) : 0
  return setupFee + mrr * Math.max(monthsInPeriod, 0)
}

function ProgressBar({ value, target, color = 'var(--color-primary)', success = false }: {
  value: number; target: number; color?: string; success?: boolean
}) {
  const pct  = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0
  const over = target > 0 && value > target
  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressBar} ${over ? styles.progressBarSuccess : ''}`}
          style={{ width: `${pct}%`, background: over ? undefined : color }}
        />
      </div>
      <span className={`${styles.progressPct} ${over ? styles.progressPctSuccess : ''}`}>
        {pct}%
      </span>
    </div>
  )
}

function fmt(n: number, currency: string) {
  const symbols: Record<string, string> = {
    PKR: '₨', USD: '$', CAD: 'CA$', AED: 'AED', SAR: 'SAR', EUR: '€', GBP: '£',
  }
  const sym = symbols[currency] ?? currency
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`
  return `${sym}${n.toFixed(0)}`
}

export default function PerformanceReport({
  user, targets, closedLeads, allLeads,
  currency, inputCurrency = 'PKR',
  rates = [], rateHistory = [],
}: Props) {

  // Convert from input currency to view currency using current rates
  function convertCurrent(amount: number): number {
    return convertAmount(amount, inputCurrency, currency, rates)
  }

  // Convert from input currency to view currency using historical rate on a date
  function convertHistorical(amount: number, onDate: string): number {
    return convertAmountHistorical(amount, inputCurrency, currency, onDate, rateHistory, rates)
  }

  // Convert a target from its stored currency to the view currency
  function convertTarget(amount: number, targetCurrency: string): number {
    if (targetCurrency === currency) return amount
    // First convert to input currency if needed, then to view currency
    const toInput = targetCurrency === inputCurrency
      ? amount
      : convertAmount(amount, targetCurrency, inputCurrency, rates)
    return convertCurrent(toInput)
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase()

  const ACTIVE_STAGES = new Set(['new','contacted','demo_scheduled','proposal_sent','negotiation'])
  const activeLeads   = allLeads.filter(l => ACTIVE_STAGES.has(l.stage))
  const pipelineValue = convertCurrent(activeLeads.reduce((sum, l) => sum + (l.quoted_setup_fee ?? 0) + getMRR(l), 0))
  const totalLeads    = allLeads.length
  const totalClosed   = closedLeads.length

  if (targets.length === 0) {
    return (
      <div>
        <div className={styles.repCard}>
          <div className={styles.repAvatar}>{initials}</div>
          <div>
            <div className={styles.repName}>{user?.full_name ?? user?.email ?? '—'}</div>
            <div className={styles.repEmail}>{user?.email}</div>
          </div>
          <div className={styles.repStats}>
            <div className={styles.repStat}><div className={styles.repStatNum}>{totalLeads}</div><div className={styles.repStatLbl}>Total Leads</div></div>
            <div className={styles.repStat}><div className={styles.repStatNum}>{totalClosed}</div><div className={styles.repStatLbl}>Closed Won</div></div>
            <div className={styles.repStat}><div className={styles.repStatNum}>{fmt(pipelineValue, currency)}</div><div className={styles.repStatLbl}>Pipeline Value</div></div>
          </div>
        </div>
        <div className={styles.noTargets}>
          No targets set for this rep yet. Go to <strong>Manage Targets</strong> tab to add one.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {/* Rep header */}
      <div className={styles.repCard}>
        <div className={styles.repAvatar}>{initials}</div>
        <div>
          <div className={styles.repName}>{user?.full_name ?? user?.email ?? '—'}</div>
          <div className={styles.repEmail}>{user?.email}</div>
        </div>
        <div className={styles.repStats}>
          <div className={styles.repStat}><div className={styles.repStatNum}>{totalLeads}</div><div className={styles.repStatLbl}>Total Leads</div></div>
          <div className={styles.repStat}><div className={styles.repStatNum}>{totalClosed}</div><div className={styles.repStatLbl}>Closed Won</div></div>
          <div className={styles.repStat}><div className={styles.repStatNum}>{fmt(pipelineValue, currency)}</div><div className={styles.repStatLbl}>Pipeline Value</div></div>
        </div>
      </div>

      {/* Target periods */}
      {targets.map(target => {
        const start = new Date(target.start_date)
        const end   = new Date(target.end_date)
        end.setHours(23, 59, 59)

        // The currency this target was entered in
        const targetCurrency = target.currency ?? inputCurrency

        // Leads closed in period — use historical rates per deal close date
        const leadsInPeriod = closedLeads.filter(l => {
          if (!l.closed_at) return false
          const d = new Date(l.closed_at)
          return d >= start && d <= end
        })

        const leadsCount = leadsInPeriod.length

        // Use historical rate on the date each deal closed
        const setupFees = leadsInPeriod.reduce((s, l) => {
          const date = l.closed_at!.split('T')[0]
          return s + convertHistorical(l.quoted_setup_fee ?? 0, date)
        }, 0)

        const mrr = leadsInPeriod.reduce((s, l) => {
          const date = l.closed_at!.split('T')[0]
          return s + convertHistorical(getMRR(l), date)
        }, 0)

        const revenue = leadsInPeriod.reduce((s, l) => {
          const date = l.closed_at!.split('T')[0]
          return s + convertHistorical(getRevenueInPeriod(l, start, end), date)
        }, 0)

        // Convert targets from their stored currency to view currency
        const setupFeeTarget = target.setup_fee_target ? convertTarget(target.setup_fee_target, targetCurrency) : null
        const mrrTarget      = target.mrr_target       ? convertTarget(target.mrr_target,       targetCurrency) : null
        const revenueTarget  = target.revenue_target   ? convertTarget(target.revenue_target,   targetCurrency) : null

        // Check if any deals lack historical rates (show disclaimer)
        const missingHistory = currency !== inputCurrency && leadsInPeriod.some(l => {
          if (!l.closed_at) return false
          const date = l.closed_at.split('T')[0]
          return !hasHistoricalRate(inputCurrency, currency, date, rateHistory)
        })

        const now      = new Date()
        const isActive = now >= start && now <= end
        const isPast   = now > end
        const isFuture = now < start

        return (
          <div key={target.id} className={`${styles.targetCard} ${isActive ? styles.activeTarget : ''}`}>
            <div className={styles.targetHeader}>
              <div>
                <div className={styles.targetLabel}>{target.label}</div>
                <div className={styles.targetDates}>
                  {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' → '}
                  {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className={styles.targetBadges}>
                <span className={`${styles.periodBadge} ${isActive ? styles.activeBadge : isPast ? styles.pastBadge : styles.futureBadge}`}>
                  {isActive ? 'Active' : isPast ? 'Completed' : 'Upcoming'}
                </span>
                <span className={styles.currencyBadge}>{currency}</span>
              </div>
            </div>

            {missingHistory && (
              <div className={styles.historyWarning}>
                ⚠ Some deals predate available exchange rate history — using current rates as fallback.
              </div>
            )}

            <div className={styles.metricsGrid}>
              {target.leads_target && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Leads Closed</span>
                    <span className={styles.metricValues}><strong>{leadsCount}</strong> / {target.leads_target}</span>
                  </div>
                  <ProgressBar value={leadsCount} target={target.leads_target} />
                </div>
              )}
              {setupFeeTarget && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Setup Fees</span>
                    <span className={styles.metricValues}><strong>{fmt(setupFees, currency)}</strong> / {fmt(setupFeeTarget, currency)}</span>
                  </div>
                  <ProgressBar value={setupFees} target={setupFeeTarget} />
                </div>
              )}
              {mrrTarget && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>MRR Added</span>
                    <span className={styles.metricValues}><strong>{fmt(mrr, currency)}</strong> / {fmt(mrrTarget, currency)}</span>
                  </div>
                  <ProgressBar value={mrr} target={mrrTarget} color="var(--stage-won-bar)" />
                </div>
              )}
              {revenueTarget && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Revenue</span>
                    <span className={styles.metricValues}><strong>{fmt(revenue, currency)}</strong> / {fmt(revenueTarget, currency)}</span>
                  </div>
                  <ProgressBar value={revenue} target={revenueTarget} color="var(--stage-proposal-bar)" />
                </div>
              )}
            </div>

            {leadsInPeriod.length > 0 && (
              <div className={styles.closedList}>
                <div className={styles.closedListTitle}>Closed deals in this period</div>
                {leadsInPeriod.map(l => (
                  <div key={l.id} className={styles.closedRow}>
                    <span className={styles.closedDot} />
                    <span className={styles.closedRepId}>Lead #{l.id.slice(0, 8)}</span>
                    {l.quoted_setup_fee && <span className={styles.closedAmt}>{fmt(convertHistorical(l.quoted_setup_fee, l.closed_at!.split('T')[0]), currency)} setup</span>}
                    {l.quoted_mrr && <span className={styles.closedAmt}>{fmt(convertHistorical(getMRR(l), l.closed_at!.split('T')[0]), currency)}/mo</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
