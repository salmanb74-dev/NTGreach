// Variables that come from the lead's Deal Panel — pre-filled, read-only
import {
  SUBSCRIPTION_DEAL_KEYS,
  SUBSCRIPTION_TEMPLATE_VARIABLES,
  subscriptionVarsFromLead,
  parseQuotedSubscription,
  totalMonthlyRecurring,
  type LeadQuoteSource,
} from '@/lib/subscription-quote'

export const QUOTATION_DEAL_KEYS = new Set([
  'setup_fee',
  'currency',
  'discount',
  'discount_note',
  'total_first_payment',
  'tax',
  'tax_note',
  ...SUBSCRIPTION_DEAL_KEYS,
])

export const QUOTATION_VARIABLES = [
  // ── Manual entry ──────────────────────────────────────────────
  { key: 'client_name', label: 'Client Name', example: 'Spice Garden Restaurants' },
  { key: 'client_address', label: 'Client Address', example: '123 Main St, Karachi' },
  { key: 'client_email', label: 'Client Email', example: 'ahmed@spice.pk' },
  { key: 'quotation_date', label: 'Quotation Date', example: '1 January 2026' },
  { key: 'valid_until', label: 'Valid Until', example: '1 February 2026' },
  {
    key: 'scope_summary',
    label: 'Scope Summary',
    example: 'NTG Resto enterprise subscription',
  },
  // ── From Deal Panel ───────────────────────────────────────────
  { key: 'currency', label: 'Currency', example: 'USD' },
  { key: 'discount', label: 'Discount Amount', example: '5,000' },
  { key: 'discount_note', label: 'Discount Note', example: 'Introductory offer' },
  { key: 'tax', label: 'Tax Amount', example: '0' },
  {
    key: 'tax_note',
    label: 'Tax Note',
    example: 'Prices are exclusive of applicable taxes',
  },
  { key: 'total_first_payment', label: 'Total First Payment', example: '60,000' },
  ...SUBSCRIPTION_TEMPLATE_VARIABLES.map(v => ({
    key: v.key,
    label: v.label,
    example: v.example,
  })),
]

// ─── Substitute variables in HTML content ─────────────────────
export function substituteQuotationVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value || `[${key}]`)
  }
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">{{$1}}</span>'
  )
  return result
}

// ─── Pre-fill variables from a lead ───────────────────────────
export function prefillQuotationFromLead(
  lead: LeadQuoteSource & {
    contact_name: string
    company_name: string
  },
  inputCurrency: string
): Record<string, string> {
  const today = new Date()
  const validUntil = new Date(today)
  validUntil.setDate(validUntil.getDate() + 30)

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  const sub = parseQuotedSubscription(lead.quoted_subscription)
  const subVars = subscriptionVarsFromLead(lead, inputCurrency)

  const monthly = totalMonthlyRecurring({
    ...sub,
    monthlyPrice: sub.monthlyPrice ?? lead.quoted_mrr ?? 0,
  })
  const setup =
    (sub.paidTrial ? 0 : sub.setupFee ?? lead.quoted_setup_fee) ?? 0
  const pre =
    (sub.paidTrial ? sub.preTrialSetupFee : 0) ?? 0
  const discount = lead.discount ?? 0
  const taxRate = lead.tax_rate ?? 0

  const firstPeriod = monthly
  const subtotal = setup + pre + firstPeriod - discount
  const taxAmount = (subtotal * taxRate) / 100
  const totalFirst = subtotal + taxAmount

  return {
    client_name: lead.company_name,
    client_address: lead.address ?? '',
    client_email: lead.email ?? '',
    quotation_date: fmt(today),
    valid_until: fmt(validUntil),
    scope_summary:
      'NTG Resto platform subscription with the commercial limits and features listed below',
    ...subVars,
    discount: discount ? discount.toLocaleString() : '0',
    discount_note: discount ? 'Applied discount' : '',
    tax: taxAmount
      ? taxAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0',
    tax_note: taxRate
      ? `${taxRate}% tax applied`
      : 'Prices are exclusive of applicable taxes',
    total_first_payment: totalFirst
      ? totalFirst.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '',
  }
}
