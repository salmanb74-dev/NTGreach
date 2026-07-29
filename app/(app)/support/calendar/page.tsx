import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin } from '@/lib/roles'
import { getCurrentOnDuty } from '@/lib/actions/support-shifts'
import CalendarClient from '@/components/support/CalendarClient'
import {
  agentDisplayName,
  type ShiftAgent,
  type ShiftItem,
} from '@/lib/support/shifts'

export default async function SupportCalendarPage() {
  const supabase = createClient()
  const now = new Date()

  // Wide window so week navigation still has shift data
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 14, 0, 23, 59, 59, 999)

  const [profile, onDuty, { data: shiftRows }, { data: profiles }] = await Promise.all([
    getCachedProfile(),
    getCurrentOnDuty(),
    supabase
      .from('support_shifts')
      .select('id, agent_id, start_at, end_at, created_by, created_at, series_id')
      .gte('end_at', rangeStart.toISOString())
      .lte('start_at', rangeEnd.toISOString())
      .order('start_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, email, roles')
      .not('roles', 'eq', '{}')
      .order('full_name'),
  ])

  const agents: ShiftAgent[] = (profiles ?? [])
    .filter(p => (p.roles as string[] | null)?.some(r => r.startsWith('cs_')))
    .map(p => ({
      id:        p.id,
      full_name: p.full_name,
      email:     p.email,
      roles:     (p.roles as string[]) ?? [],
    }))

  const nameById = new Map(
    agents.map(a => [a.id, agentDisplayName(a)])
  )

  // Resolve names for agents who may no longer have cs_ roles but have shifts
  const missingIds = [...new Set((shiftRows ?? []).map(s => s.agent_id))]
    .filter(id => !nameById.has(id))

  if (missingIds.length > 0) {
    const { data: extras } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', missingIds)
    for (const p of extras ?? []) {
      nameById.set(p.id, agentDisplayName(p))
    }
  }

  const shifts: ShiftItem[] = (shiftRows ?? []).map(s => ({
    id:         s.id,
    agent_id:   s.agent_id,
    agent_name: nameById.get(s.agent_id) ?? 'Agent',
    start_at:   s.start_at,
    end_at:     s.end_at,
    created_by: s.created_by,
    created_at: s.created_at,
    series_id:  (s as { series_id?: string | null }).series_id ?? null,
  }))

  return (
    <CalendarClient
      initialShifts={shifts}
      agents={agents}
      onDuty={onDuty}
      canManage={isCsAdmin(profile)}
    />
  )
}
