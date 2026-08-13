// Variables that come from the lead's Deal Panel — pre-filled, read-only
import {
  SUBSCRIPTION_DEAL_KEYS,
  SUBSCRIPTION_TEMPLATE_VARIABLES,
  subscriptionVarsFromLead,
  type LeadQuoteSource,
} from '@/lib/subscription-quote'

export const CONTRACT_DEAL_KEYS = new Set([
  'setup_fee',
  'currency',
  ...SUBSCRIPTION_DEAL_KEYS,
])

export const CONTRACT_VARIABLES = [
  // ── Manual entry ──────────────────────────────────────────────
  { key: 'client_name', label: 'Client Name', example: 'Spice Garden Restaurants' },
  { key: 'client_address', label: 'Client Address', example: '123 Main St, Karachi' },
  { key: 'client_email', label: 'Client Email', example: 'ahmed@spice.pk' },
  {
    key: 'contract_date',
    label: 'Contract Date',
    example: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  },
  { key: 'start_date', label: 'Service Start Date', example: '1 January 2026' },
  // ── From Deal Panel (subscription quote) ─────────────────────
  { key: 'currency', label: 'Currency', example: 'USD' },
  ...SUBSCRIPTION_TEMPLATE_VARIABLES.map(v => ({
    key: v.key,
    label: v.label,
    example: v.example,
  })),
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
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">{{$1}}</span>'
  )
  return result
}

// ─── Pre-fill variables from a lead ───────────────────────────
export function prefillFromLead(
  lead: LeadQuoteSource & {
    contact_name: string
    company_name: string
  },
  inputCurrency: string
): Record<string, string> {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const subVars = subscriptionVarsFromLead(lead, inputCurrency)

  return {
    client_name: lead.company_name,
    client_address: lead.address ?? '',
    client_email: lead.email ?? '',
    contract_date: today,
    start_date: subVars.trial_starts || today,
    ...subVars,
  }
}
