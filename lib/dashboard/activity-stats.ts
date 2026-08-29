import type { DashboardActivity } from '@/lib/dashboard/types'

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
