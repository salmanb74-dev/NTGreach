// Variables that come from the lead's Deal Panel — pre-filled, read-only
export const CONTRACT_DEAL_KEYS = new Set([
  'setup_fee', 'recurring_fee', 'payment_frequency', 'currency',
])

export const CONTRACT_VARIABLES = [
  // ── Manual entry ──────────────────────────────────────────────
  { key: 'client_name',       label: 'Client Name',       example: 'Spice Garden Restaurants' },
  { key: 'client_address',    label: 'Client Address',     example: '123 Main St, Karachi' },
  { key: 'client_email',      label: 'Client Email',       example: 'ahmed@spice.pk' },
  { key: 'contract_date',     label: 'Contract Date',      example: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
  { key: 'start_date',        label: 'Service Start Date', example: '1 January 2026' },
  { key: 'contract_term',     label: 'Contract Term',      example: '12 months' },
  // ── From Deal Panel (read-only) ────────────────────────────────
  { key: 'currency',          label: 'Currency',           example: 'PKR' },
  { key: 'setup_fee',         label: 'Setup Fee',          example: '50,000' },
  { key: 'recurring_fee',     label: 'Recurring Fee',      example: '15,000' },
  { key: 'payment_frequency', label: 'Payment Frequency',  example: 'month' },
]


// ─── Substitute variables in HTML content ─────────────────────
export function substituteVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value || `[${key}]`)
  }
  // Highlight any remaining unsubstituted variables
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">{{$1}}</span>'
  )
  return result
}

// ─── Pre-fill variables from a lead ───────────────────────────
export function prefillFromLead(lead: {
  contact_name:       string
  company_name:       string
  email?:             string | null
  address?:           string | null
  quoted_setup_fee?:  number | null
  quoted_mrr?:        number | null
  payment_frequency?: string | null
  deal_currency?:     string | null
}, inputCurrency: string): Record<string, string> {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return {
    client_name:       lead.company_name,
    client_address:    lead.address ?? '',
    client_email:      lead.email ?? '',
    contract_date:     today,
    start_date:        today,
    contract_term:     '12 months',
    setup_fee:         lead.quoted_setup_fee
      ? lead.quoted_setup_fee.toLocaleString()
      : '',
    recurring_fee:     lead.quoted_mrr
      ? lead.quoted_mrr.toLocaleString()
      : '',
    payment_frequency: lead.payment_frequency === 'annual' ? 'year' : 'month',
    currency:          lead.deal_currency ?? inputCurrency,
  }
}
