// Variables that come from the lead's Deal Panel — pre-filled, read-only
import {
  SUBSCRIPTION_DEAL_KEYS,
  SUBSCRIPTION_TEMPLATE_VARIABLES,
  subscriptionVarsFromLead,
  formatTemplateDate,
  type LeadQuoteSource,
} from '@/lib/subscription-quote'

export const CONTRACT_DEAL_KEYS = new Set([
  'setup_fee',
  'currency',
  ...SUBSCRIPTION_DEAL_KEYS,
])

export const CONTRACT_VARIABLES = [
  { key: 'client_name', label: 'Client Name', example: 'Spice Garden Restaurants' },
  { key: 'client_address', label: 'Client Address', example: '123 Main St, Karachi' },
  { key: 'client_email', label: 'Client Email', example: 'ahmed@spice.pk' },
  {
    key: 'contract_date',
    label: 'Contract Date',
    example: formatTemplateDate(new Date()),
  },
  { key: 'start_date', label: 'Service Start Date', example: '1 January 2026' },
  { key: 'currency', label: 'Currency', example: 'US$' },
  ...SUBSCRIPTION_TEMPLATE_VARIABLES.map(v => ({
    key: v.key,
    label: v.label,
    example: v.example,
  })),
]

export { substituteTemplateHtml as substituteVariables } from '@/lib/template-vars'

export function prefillFromLead(
  lead: LeadQuoteSource & {
    contact_name: string
    company_name: string
  },
  inputCurrency: string,
  currencyLabels?: Record<string, string> | null
): Record<string, string> {
  const today = formatTemplateDate(new Date())
  const subVars = subscriptionVarsFromLead(lead, inputCurrency, currencyLabels)

  return {
    client_name: lead.company_name,
    client_address: lead.address ?? '',
    client_email: lead.email ?? '',
    contract_date: today,
    start_date: subVars.trial_starts || today,
    ...subVars,
  }
}
