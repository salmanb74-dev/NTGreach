// ─── Pipeline Stages ─────────────────────────────────────────────────
export type PipelineStage =
  | 'new'
  | 'contacted'
  | 'demo_scheduled'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'
  | 'early_exit'

export const PIPELINE_STAGES: PipelineStage[] = [
  'new',
  'contacted',
  'demo_scheduled',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
  'early_exit'
]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new:            'New',
  contacted:      'Contacted',
  demo_scheduled: 'Demo Scheduled',
  proposal_sent:  'Proposal Sent',
  negotiation:    'Negotiation',
  closed_won:     'Closed Won',
  closed_lost:    'Closed Lost',
  early_exit:    'Early Exit',
}

// Maps each stage to its CSS variable names from theme.css
export const STAGE_CSS: Record<PipelineStage, string> = {
  new:            'new',
  contacted:      'contacted',
  demo_scheduled: 'demo',
  proposal_sent:  'proposal',
  negotiation:    'negotiation',
  closed_won:     'won',
  closed_lost:    'lost',
  early_exit:    'early_exit',
}

// ─── Activity Types ───────────────────────────────────────────────────
export type ActivityType =
  | 'email_outbound'
  | 'email_inbound'
  | 'whatsapp_log'
  | 'call'
  | 'meeting'
  | 'note'
  | 'stage_change'
  | 'site_visit'

// ─── Lead Sources ─────────────────────────────────────────────────────
export type LeadSource =
  | 'cold_call'
  | 'cold_email'
  | 'referral'
  | 'linkedin'
  | 'website'
  | 'event'
  | 'import'
  | 'other'

export const SOURCE_LABELS: Record<LeadSource, string> = {
  cold_call:  'Cold Call',
  cold_email: 'Cold Email',
  referral:   'Referral',
  linkedin:   'LinkedIn',
  website:    'Website',
  event:      'Event',
  import:     'Import',
  other:      'Other',
}

// ─── Restaurant Types ─────────────────────────────────────────────────
export const RESTAURANT_TYPES = [
  'Fast Food Chain',
  'Fine Dining',
  'Casual Dining',
  'Café / Coffee Shop',
  'Bakery',
  'Food Court',
  'Cloud Kitchen',
  'Multi-branch Chain',
  'Hotel Restaurant',
  'Other',
]

// ─── Database Row Types ───────────────────────────────────────────────
export interface Lead {
  id: string
  company_name: string
  contact_name: string
  email: string | null
  phone: string | null
  city: string | null
  restaurant_type: string | null
  source: LeadSource | null
  stage: PipelineStage
  address: string | null
  notes: string | null
  quoted_setup_fee:   number | null
  quoted_mrr:         number | null
  deal_currency:      string | null
  discount?:          number | null
  tax_rate?:          number | null
  closed_at:          string | null
  payment_start_date: string | null
  payment_frequency:  'monthly' | 'annual' | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  subject: string | null
  body: string | null
  direction: 'inbound' | 'outbound' | null
  duration_minutes: number | null
  outcome: string | null
  created_by: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface Meeting {
  id: string
  lead_id: string
  teams_event_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number | null
  notes: string | null
  created_at: string
}

export interface Email {
  id: string
  lead_id: string
  mailjet_message_id: string | null
  subject: string
  body: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
  sent_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  email: string
  ms_access_token: string | null
  ms_token_expiry: string | null
  created_at: string
}

export interface Target {
  id:               string
  user_id:          string
  label:            string
  start_date:       string
  end_date:         string
  currency:         string
  leads_target:     number | null
  setup_fee_target: number | null
  mrr_target:       number | null
  revenue_target:   number | null
  created_at:       string
}
