import type { ExchangeRate } from '@/lib/currency'
import { convertAmount } from '@/lib/currency'
import {
  DEFAULT_PAID_TRIAL_DAYS,
  hydrateQuotedSubscriptionFromLead,
  monthsForBillingCycle,
  totalMonthlyRecurring,
  webOrderingSetupFee,
  type LeadQuoteSource,
  type QuotedSubscription,
} from '@/lib/subscription-quote'

/** All one-time setup fees (trial pre/post or standard + web ordering). */
export function totalSetupFees(sub: QuotedSubscription): number {
  if (sub.paidTrial) {
    return (
      (sub.preTrialSetupFee ?? 0) +
      (sub.postTrialSetupFee ?? 0) +
      webOrderingSetupFee(sub)
    )
  }
  return (sub.setupFee ?? 0) + webOrderingSetupFee(sub)
}

export function annualRecurring(sub: QuotedSubscription): number {
  return totalMonthlyRecurring(sub) * 12
}

/** Setup fees + 12 months of recurring for one lead. */
export function pipelineValueForLead(lead: LeadQuoteSource): number {
  const sub = hydrateQuotedSubscriptionFromLead(lead)
  return totalSetupFees(sub) + annualRecurring(sub)
}

export function pipelineValueForLeads(leads: LeadQuoteSource[]): number {
  return leads.reduce((sum, l) => sum + pipelineValueForLead(l), 0)
}

export function convertLeadAmount(
  amount: number,
  lead: LeadQuoteSource,
  inputCurrency: string,
  displayCurrency: string,
  rates: ExchangeRate[]
): number {
  const from = lead.deal_currency?.trim() || inputCurrency
  return convertAmount(amount, from, displayCurrency, rates)
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + months)
  return out
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1
  return `Q${q} ${date.getFullYear()}`
}

function quarterStartFromNow(): Date {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  return new Date(now.getFullYear(), q * 3, 1)
}

type PaymentEvent = { date: Date; setup: number; recurring: number }

/** Project setup + recurring invoices for the next 12 months from deal terms. */
export function projectLeadPayments(lead: LeadQuoteSource): PaymentEvent[] {
  const sub = hydrateQuotedSubscriptionFromLead(lead)
  const monthly = totalMonthlyRecurring(sub)
  const cycleMonths = monthsForBillingCycle(sub.billingCycle)
  const cycleAmount = monthly * cycleMonths

  const anchor = lead.payment_start_date
    ? new Date(lead.payment_start_date)
    : new Date()

  if (Number.isNaN(anchor.getTime())) return []

  const events: PaymentEvent[] = []
  let recurFrom: Date

  if (sub.paidTrial) {
    const pre = (sub.preTrialSetupFee ?? 0) + webOrderingSetupFee(sub)
    if (pre > 0) events.push({ date: new Date(anchor), setup: pre, recurring: 0 })

    const trialDays = sub.paidTrialDays ?? DEFAULT_PAID_TRIAL_DAYS
    const afterTrial = new Date(anchor)
    afterTrial.setDate(afterTrial.getDate() + trialDays)

    const post = sub.postTrialSetupFee ?? 0
    if (post > 0) events.push({ date: afterTrial, setup: post, recurring: 0 })

    recurFrom = afterTrial
  } else {
    const setup = (sub.setupFee ?? 0) + webOrderingSetupFee(sub)
    if (setup > 0) events.push({ date: new Date(anchor), setup, recurring: 0 })
    recurFrom = new Date(anchor)
  }

  const horizon = addMonths(new Date(), 12)
  let d = new Date(recurFrom)
  while (d <= horizon) {
    if (cycleAmount > 0) {
      events.push({ date: new Date(d), setup: 0, recurring: cycleAmount })
    }
    d = addMonths(d, cycleMonths)
  }

  return events
}

export type QuarterPaymentDatum = {
  quarter: string
  setup: number
  recurring: number
  total: number
}

/** Aggregate expected cash by calendar quarter (current + next 3). */
export function buildQuarterlyPayments(
  leads: LeadQuoteSource[],
  inputCurrency: string,
  displayCurrency: string,
  rates: ExchangeRate[],
  quarterCount = 4
): QuarterPaymentDatum[] {
  const labels: string[] = []
  const buckets = new Map<string, { setup: number; recurring: number }>()

  let qStart = quarterStartFromNow()
  for (let i = 0; i < quarterCount; i++) {
    const label = quarterLabel(qStart)
    labels.push(label)
    buckets.set(label, { setup: 0, recurring: 0 })
    qStart = addMonths(qStart, 3)
  }

  for (const lead of leads) {
    for (const ev of projectLeadPayments(lead)) {
      const label = quarterLabel(ev.date)
      const bucket = buckets.get(label)
      if (!bucket) continue
      bucket.setup += convertLeadAmount(
        ev.setup,
        lead,
        inputCurrency,
        displayCurrency,
        rates
      )
      bucket.recurring += convertLeadAmount(
        ev.recurring,
        lead,
        inputCurrency,
        displayCurrency,
        rates
      )
    }
  }

  return labels.map(quarter => {
    const b = buckets.get(quarter)!
    return {
      quarter,
      setup: b.setup,
      recurring: b.recurring,
      total: b.setup + b.recurring,
    }
  })
}

export function pipelineValueInDisplay(
  leads: LeadQuoteSource[],
  inputCurrency: string,
  displayCurrency: string,
  rates: ExchangeRate[]
): number {
  return leads.reduce(
    (sum, lead) =>
      sum +
      convertLeadAmount(
        pipelineValueForLead(lead),
        lead,
        inputCurrency,
        displayCurrency,
        rates
      ),
    0
  )
}
