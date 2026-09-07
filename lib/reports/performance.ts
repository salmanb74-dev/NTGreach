/**
 * Target-period performance helpers for Reports.
 * Paid deals (`payment_received`) are attributed by subscription start date.
 * Revenue uses whole billing invoices (no mid-month proration).
 */

import { parseDurationMonths } from '@/lib/subscription-quote'

export type ReportLead = {
  id: string
  stage: string
  company_name?: string | null
  contact_name?: string | null
  quoted_setup_fee: number | null
  quoted_mrr: number | null
  payment_frequency: string | null
  payment_start_date: string | null
  closed_at: string | null
  created_by: string | null
  /** When stage last changed (used if subscription/closed dates are missing). */
  updated_at?: string | null
  created_at?: string | null
}

/**
 * Date used to put a Paid deal in a target period.
 * Prefer subscription start → Paid stamp → last update → created.
 */
export function leadBookingDate(lead: ReportLead): Date | null {
  const raw =
    lead.payment_start_date ||
    lead.closed_at ||
    lead.updated_at ||
    lead.created_at
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d)
  out.setMonth(out.getMonth() + months)
  return out
}

/** Billing cycle length in months (1 = monthly, 12 = annual, …). */
export function billingCycleMonths(lead: ReportLead): number {
  return Math.max(1, parseDurationMonths(lead.payment_frequency))
}

/**
 * Count whole billing invoices whose charge date falls inside the target period.
 * No proration — a cycle that starts in-period counts as a full invoice amount.
 */
export function wholeInvoicesInPeriod(
  lead: ReportLead,
  periodStart: Date,
  periodEnd: Date
): number {
  const book = leadBookingDate(lead)
  if (!book) return 0

  const cycle = billingCycleMonths(lead)
  const start = startOfDay(periodStart)
  const end = endOfDay(periodEnd)

  let count = 0
  let invoice = startOfDay(book)
  // Cap iterations (e.g. monthly over a few years)
  for (let i = 0; i < 120; i++) {
    if (invoice > end) break
    if (invoice >= start) count += 1
    invoice = addMonths(invoice, cycle)
  }
  return count
}

/**
 * Estimated cash from the lead inside the target window:
 * - Full setup fee if subscription starts inside the period
 * - Full MRR × cycle months for each invoice date that falls in the period
 *   (e.g. 10K/mo starting mid-Aug with period through Sep → 10K + 10K = 20K, not 12K)
 */
export function estimatedRevenueInPeriod(
  lead: ReportLead,
  periodStart: Date,
  periodEnd: Date
): number {
  const book = leadBookingDate(lead)
  if (!book) return 0

  const mrr = lead.quoted_mrr ?? 0
  const setup = lead.quoted_setup_fee ?? 0
  const cycle = billingCycleMonths(lead)
  const invoiceAmount = mrr * cycle

  const setupInPeriod =
    book >= startOfDay(periodStart) && book <= endOfDay(periodEnd) ? setup : 0

  const invoices = wholeInvoicesInPeriod(lead, periodStart, periodEnd)
  return setupInPeriod + invoiceAmount * invoices
}

export function isPaidLead(lead: ReportLead): boolean {
  return lead.stage === 'payment_received'
}

export function paidLeadsInPeriod(
  leads: ReportLead[],
  periodStart: Date,
  periodEnd: Date
): ReportLead[] {
  const start = startOfDay(periodStart)
  const end = endOfDay(periodEnd)
  return leads.filter(l => {
    if (!isPaidLead(l)) return false
    const book = leadBookingDate(l)
    if (!book) return false
    return book >= start && book <= end
  })
}

export function formatBookingDate(lead: ReportLead): string {
  const d = leadBookingDate(lead)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
