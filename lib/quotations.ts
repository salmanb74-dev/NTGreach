// Variables that come from the lead's Deal Panel — pre-filled, read-only
export const QUOTATION_DEAL_KEYS = new Set([
  'setup_fee', 'recurring_fee', 'payment_frequency', 'currency',
  'discount', 'discount_note', 'total_first_payment', 'tax', 'tax_note',
])

export const QUOTATION_VARIABLES = [
  // ── Manual entry ──────────────────────────────────────────────
  { key: 'client_name',         label: 'Client Name',        example: 'Spice Garden Restaurants' },
  { key: 'client_address',      label: 'Client Address',      example: '123 Main St, Karachi' },
  { key: 'client_email',        label: 'Client Email',        example: 'ahmed@spice.pk' },
  { key: 'quotation_date',      label: 'Quotation Date',      example: '1 January 2026' },
  { key: 'valid_until',         label: 'Valid Until',         example: '1 February 2026' },
  { key: 'scope_summary',       label: 'Scope Summary',       example: 'NTG Reach CRM subscription for 5 users' },
  // ── From Deal Panel (read-only) ────────────────────────────────
  { key: 'currency',            label: 'Currency',            example: 'PKR' },
  { key: 'setup_fee',           label: 'Setup Fee',           example: '50,000' },
  { key: 'recurring_fee',       label: 'Recurring Fee',       example: '15,000' },
  { key: 'payment_frequency',   label: 'Payment Frequency',   example: 'month' },
  { key: 'discount',            label: 'Discount Amount',     example: '5,000' },
  { key: 'discount_note',       label: 'Discount Note',       example: 'Introductory offer' },
  { key: 'tax',                 label: 'Tax Amount',          example: '0' },
  { key: 'tax_note',            label: 'Tax Note',            example: 'Prices are exclusive of applicable taxes' },
  { key: 'total_first_payment', label: 'Total First Payment', example: '60,000' },
]


// ─── Substitute variables in HTML content ─────────────────────
export function substituteQuotationVariables(
  content:   string,
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
export function prefillQuotationFromLead(lead: {
  contact_name:       string
  company_name:       string
  email?:             string | null
  address?:           string | null
  quoted_setup_fee?:  number | null
  quoted_mrr?:        number | null
  payment_frequency?: string | null
  deal_currency?:     string | null
  discount?:          number | null
  tax_rate?:          number | null
}, inputCurrency: string): Record<string, string> {
  const today = new Date()
  const validUntil = new Date(today)
  validUntil.setDate(validUntil.getDate() + 30)

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const setupFee   = lead.quoted_setup_fee ?? 0
  const recurring  = lead.quoted_mrr       ?? 0
  const discount   = lead.discount         ?? 0
  const taxRate    = lead.tax_rate         ?? 0

  const subtotal   = setupFee + recurring - discount
  const taxAmount  = subtotal * taxRate / 100
  const totalFirst = subtotal + taxAmount

  return {
    client_name:         lead.company_name,
    client_address:      lead.address      ?? '',
    client_email:        lead.email        ?? '',
    quotation_date:      fmt(today),
    valid_until:         fmt(validUntil),
    scope_summary:       'NTG Reach CRM platform subscription and onboarding',
    setup_fee:           setupFee  ? setupFee.toLocaleString()  : '',
    recurring_fee:       recurring ? recurring.toLocaleString() : '',
    payment_frequency:   lead.payment_frequency === 'annual' ? 'year' : 'month',
    discount:            discount  ? discount.toLocaleString()  : '0',
    discount_note:       discount  ? 'Applied discount'         : '',
    tax:                 taxAmount ? taxAmount.toFixed(2)        : '0',
    tax_note:            taxRate   ? `${taxRate}% tax applied`  : 'Prices are exclusive of applicable taxes',
    total_first_payment: totalFirst ? totalFirst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
    currency:            lead.deal_currency ?? inputCurrency,
  }
}

