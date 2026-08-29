import type { PipelineStage } from '@/lib/types'
import type { LeadQuoteSource } from '@/lib/subscription-quote'

export type DashboardLead = LeadQuoteSource & {
  id: string
  stage: PipelineStage | string
}

export type DashboardActivity = {
  type: string
  lead_id: string
  created_at: string
}

export type DashboardMeeting = {
  lead_id: string
  created_at: string
}
