import type { Target } from '@/lib/types'
import { ACTIVE_PIPELINE_STAGES } from '@/lib/types'
import {
  convertAmount,
  convertAmountHistorical,
  hasHistoricalRate,
  type ExchangeRate,
  type ExchangeRateHistory,
} from '@/lib/currency'
import {
  estimatedRevenueInPeriod,
  formatBookingDate,
  isPaidLead,
  leadBookingDate,
  paidLeadsInPeriod,
  wholeInvoicesInPeriod,
  type ReportLead,
} from '@/lib/reports/performance'
import styles from './PerformanceReport.module.css'

interface User {
  id: string
  full_name: string | null
  email: string
}

interface Props {
  user:          User | undefined
  targets:       Target[]
  /** All leads for the rep (any stage). Paid filtering happens here. */
  allLeads:      ReportLead[]
  currency:      string
  inputCurrency: string
  rates:         ExchangeRate[]
  rateHistory?:  ExchangeRateHistory[]
}

function ProgressBar({ value, target, color = 'var(--color-primary)' }: {
  value: number; target: number; color?: string
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

function leadLabel(l: ReportLead) {
  return l.company_name || l.contact_name || `Lead #${l.id.slice(0, 8)}`
}

export default function PerformanceReport({
  user, targets, allLeads,
  currency, inputCurrency = 'PKR',
  rates = [], rateHistory = [],
}: Props) {
  function convertCurrent(amount: number): number {
    return convertAmount(amount, inputCurrency, currency, rates)
  }

  function convertHistorical(amount: number, onDate: string): number {
    return convertAmountHistorical(amount, inputCurrency, currency, onDate, rateHistory, rates)
  }

  function convertTarget(amount: number, targetCurrency: string): number {
    if (targetCurrency === currency) return amount
    const toInput = targetCurrency === inputCurrency
      ? amount
      : convertAmount(amount, targetCurrency, inputCurrency, rates)
    return convertCurrent(toInput)
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase()

  const ACTIVE_STAGES = new Set<string>(ACTIVE_PIPELINE_STAGES)
  const activeLeads   = allLeads.filter(l => ACTIVE_STAGES.has(l.stage))
  const paidLeads     = allLeads.filter(isPaidLead)
  const totalLeads = allLeads.length
  const totalPaid  = paidLeads.length
  const totalActive = activeLeads.length

  const repHeader = (
    <div className={styles.repCard}>
      <div className={styles.repAvatar}>{initials}</div>
      <div>
        <div className={styles.repName}>{user?.full_name ?? user?.email ?? '—'}</div>
        <div className={styles.repEmail}>{user?.email}</div>
      </div>
      <div className={styles.repStats}>
        <div className={styles.repStat}>
          <div className={styles.repStatNum}>{totalLeads}</div>
          <div className={styles.repStatLbl}>Total Leads</div>
        </div>
        <div className={styles.repStat}>
          <div className={styles.repStatNum}>{totalActive}</div>
          <div className={styles.repStatLbl}>In Pipeline</div>
        </div>
        <div className={styles.repStat}>
          <div className={styles.repStatNum}>{totalPaid}</div>
          <div className={styles.repStatLbl}>Paid</div>
        </div>
      </div>
    </div>
  )

  if (targets.length === 0) {
    return (
      <div>
        {repHeader}
        <div className={styles.noTargets}>
          No targets set for this rep yet. Go to <strong>Settings → Targets</strong> to add one.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {repHeader}

      {targets.map(target => {
        const start = new Date(target.start_date)
        const end   = new Date(target.end_date)
        end.setHours(23, 59, 59, 999)

        const targetCurrency = target.currency ?? inputCurrency
        const leadsInPeriod = paidLeadsInPeriod(allLeads, start, end)
        const leadsCount = leadsInPeriod.length

        const revenue = leadsInPeriod.reduce((s, l) => {
          const book = leadBookingDate(l)
          const date = (book ?? start).toISOString().split('T')[0]
          return s + convertHistorical(estimatedRevenueInPeriod(l, start, end), date)
        }, 0)

        const revenueTarget =
          target.revenue_target != null
            ? convertTarget(target.revenue_target, targetCurrency)
            : null

        const missingHistory =
          currency !== inputCurrency &&
          leadsInPeriod.some(l => {
            const book = leadBookingDate(l)
            if (!book) return false
            return !hasHistoricalRate(
              inputCurrency,
              currency,
              book.toISOString().split('T')[0],
              rateHistory
            )
          })

        const now      = new Date()
        const isActive = now >= start && now <= end
        const isPast   = now > end

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
              {target.leads_target != null && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Leads Paid</span>
                    <span className={styles.metricValues}>
                      <strong>{leadsCount}</strong> / {target.leads_target}
                    </span>
                  </div>
                  <ProgressBar value={leadsCount} target={target.leads_target} />
                </div>
              )}
              {revenueTarget != null && (
                <div className={styles.metric}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Est. Revenue</span>
                    <span className={styles.metricValues}>
                      <strong>{fmt(revenue, currency)}</strong> / {fmt(revenueTarget, currency)}
                    </span>
                  </div>
                  <ProgressBar
                    value={revenue}
                    target={revenueTarget}
                    color="var(--stage-proposal-bar)"
                  />
                </div>
              )}
            </div>

            <p className={styles.metricHint}>
              Revenue = setup (if start is in period) + full monthly invoices whose charge date
              falls in the period (no mid-month proration).
            </p>

            {leadsInPeriod.length > 0 && (
              <div className={styles.closedList}>
                <div className={styles.closedListTitle}>Paid deals in this period</div>
                {leadsInPeriod.map(l => {
                  const book = leadBookingDate(l)
                  const dateKey = (book ?? start).toISOString().split('T')[0]
                  const est = estimatedRevenueInPeriod(l, start, end)
                  const invoices = wholeInvoicesInPeriod(l, start, end)
                  return (
                    <div key={l.id} className={styles.closedRow}>
                      <span className={styles.closedDot} />
                      <span className={styles.closedRepId}>
                        {leadLabel(l)}
                        <span className={styles.closedDate}>
                          {' · '}starts {formatBookingDate(l)}
                        </span>
                      </span>
                      {l.quoted_setup_fee != null && l.quoted_setup_fee > 0 && (
                        <span className={styles.closedAmt}>
                          {fmt(convertHistorical(l.quoted_setup_fee, dateKey), currency)} setup
                        </span>
                      )}
                      {l.quoted_mrr != null && l.quoted_mrr > 0 && (
                        <span className={styles.closedAmt}>
                          {fmt(convertHistorical(l.quoted_mrr, dateKey), currency)}/mo
                          {invoices > 0 ? ` × ${invoices}` : ''}
                        </span>
                      )}
                      <span className={styles.closedAmt}>
                        {fmt(convertHistorical(est, dateKey), currency)} in period
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {leadsInPeriod.length === 0 && (target.leads_target != null || revenueTarget != null) && (
              <div className={styles.emptyPeriod}>
                No Paid deals attributed to this period yet. Set a subscription start date on the lead,
                or re-save the Paid stage so a date is stamped.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
