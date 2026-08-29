import {
  PIPELINE_STAGES,
  ACTIVE_PIPELINE_STAGES,
  type PipelineStage,
} from '@/lib/types'
import { buildSixMonthActivityBreakdown } from '@/lib/dashboard/activity-breakdown'
import type { LeadQuoteSource } from '@/lib/dashboard/deal-values'

export type DashboardLead = LeadQuoteSource & {
  id: string
  stage: PipelineStage | string
}

export type DashboardActivity = {
  type: string
  lead_id: string
  created_at: string
}

export function filterLeadsByStages(
  leads: DashboardLead[],
  stages: Set<PipelineStage>
): DashboardLead[] {
  return leads.filter(l => stages.has(l.stage as PipelineStage))
}

export function countsByStageForLeads(leads: DashboardLead[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of PIPELINE_STAGES) counts[s] = 0
  for (const l of leads) {
    if (l.stage) counts[l.stage] = (counts[l.stage] ?? 0) + 1
  }
  return counts
}

export function computeDashboardStats(leads: DashboardLead[]) {
  const counts = countsByStageForLeads(leads)
  const totalLeads = leads.length
  const closedWon = counts['closed_won'] ?? 0
  const closedLost = counts['closed_lost'] ?? 0
  const paymentReceived = counts['payment_received'] ?? 0
  const activeSet = new Set<string>(ACTIVE_PIPELINE_STAGES)
  const activeLeads = leads.filter(l => activeSet.has(l.stage)).length

  return {
    totalLeads,
    closedWon,
    closedLost,
    paymentReceived,
    activeLeads,
    counts,
  }
}

/** Win rate across all leads — not affected by dashboard stage filters. */
export function computeWinRate(leads: DashboardLead[]): number | null {
  const counts = countsByStageForLeads(leads)
  const wins = (counts['payment_received'] ?? 0) + (counts['closed_won'] ?? 0)
  const lost = counts['closed_lost'] ?? 0
  if (lost === 0) return null
  return Math.round((wins / lost) * 100)
}

export function filterActivitiesByLeadIds(
  activities: DashboardActivity[],
  leadIds: Set<string>
) {
  return activities.filter(a => leadIds.has(a.lead_id))
}

export function countByLeadIds(items: { lead_id: string }[], leadIds: Set<string>) {
  return items.filter(i => leadIds.has(i.lead_id)).length
}

export function countActivitiesByType(
  activities: DashboardActivity[],
  leadIds: Set<string>,
  type: string
) {
  return activities.filter(a => a.type === type && leadIds.has(a.lead_id)).length
}

export function countFieldTouchpoints(
  activities: DashboardActivity[],
  leadIds: Set<string>
) {
  return activities.filter(
    a =>
      leadIds.has(a.lead_id) &&
      (a.type === 'whatsapp_log' || a.type === 'call' || a.type === 'site_visit')
  ).length
}

export function activityBreakdownForLeads(
  activities: DashboardActivity[],
  leadIds: Set<string>,
  meetings: { lead_id: string; created_at: string }[] = []
) {
  return buildSixMonthActivityBreakdown(activities, leadIds, meetings)
}
