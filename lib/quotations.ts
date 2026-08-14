// Variables that come from the lead's Deal Panel — pre-filled, read-only
import {
  SUBSCRIPTION_DEAL_KEYS,
  SUBSCRIPTION_TEMPLATE_VARIABLES,
  subscriptionVarsFromLead,
  formatTemplateDate,
  QUOTATION_VALIDITY_DAYS,
  type LeadQuoteSource,
} from '@/lib/subscription-quote'

export const QUOTATION_DEAL_KEYS = new Set([
  'setup_fee',
  'currency',
  ...SUBSCRIPTION_DEAL_KEYS,
])

export const QUOTATION_VARIABLES = [
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
  { key: 'currency', label: 'Currency', example: 'US$' },
  ...SUBSCRIPTION_TEMPLATE_VARIABLES.map(v => ({
    key: v.key,
    label: v.label,
    example: v.example,
  })),
]

export { substituteTemplateHtml as substituteQuotationVariables } from '@/lib/template-vars'

export function prefillQuotationFromLead(
  lead: LeadQuoteSource & {
    contact_name: string
    company_name: string
  },
  inputCurrency: string,
  currencyLabels?: Record<string, string> | null
): Record<string, string> {
  const today = new Date()
  const validUntil = new Date(today)
  validUntil.setDate(validUntil.getDate() + QUOTATION_VALIDITY_DAYS)

  const subVars = subscriptionVarsFromLead(lead, inputCurrency, currencyLabels)

  return {
    client_name: lead.company_name,
    client_address: lead.address ?? '',
    client_email: lead.email ?? '',
    quotation_date: formatTemplateDate(today),
    valid_until: formatTemplateDate(validUntil),
    scope_summary:
      'NTG Resto platform subscription with the commercial limits and features listed below',
    ...subVars,
  }
}
