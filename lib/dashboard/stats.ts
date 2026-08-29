import {
  PIPELINE_STAGES,
  ACTIVE_PIPELINE_STAGES,
  type PipelineStage,
} from '@/lib/types'
import type { DashboardLead } from '@/lib/dashboard/types'

export type { DashboardLead, DashboardActivity, DashboardMeeting } from '@/lib/dashboard/types'

export function filterLeadsByStages(
  leads: DashboardLead[],
  stages: Set<PipelineStage>
): DashboardLead[] {
  return leads.filter(l => stages.has(l.stage as PipelineStage))
}

function countsByStageForLeads(leads: DashboardLead[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of PIPELINE_STAGES) counts[s] = 0
  for (const l of leads) {
    if (l.stage) counts[l.stage] = (counts[l.stage] ?? 0) + 1
  }
  return counts
}

export function computeDashboardStats(leads: DashboardLead[]) {
  const counts = countsByStageForLeads(leads)
  const activeSet = new Set<string>(ACTIVE_PIPELINE_STAGES)

  return {
    totalLeads: leads.length,
    closedLost: counts['closed_lost'] ?? 0,
    paymentReceived: counts['payment_received'] ?? 0,
    activeLeads: leads.filter(l => activeSet.has(l.stage)).length,
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
