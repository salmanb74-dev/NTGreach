import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin, isCsManager } from '@/lib/roles'
import {
  getActiveClockIn,
  getTimeLogs,
} from '@/lib/actions/support-time'
import TimeClient from '@/components/support/TimeClient'
import {
  agentLabel,
  type TimeAgent,
} from '@/lib/support/time'

export default async function SupportTimePage() {
  const supabase = createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const profile = await getCachedProfile()
  if (!profile) return null

  const canViewAll = isCsManager(profile)
  const canExport = isCsAdmin(profile)

  const [active, logs, { data: profiles }] = await Promise.all([
    getActiveClockIn(profile.id),
    getTimeLogs(profile.id, month, year),
    canViewAll
      ? supabase
          .from('profiles')
          .select('id, full_name, email, roles')
          .not('roles', 'eq', '{}')
          .order('full_name')
      : Promise.resolve({ data: null }),
  ])

  const agents: TimeAgent[] = canViewAll
    ? (profiles ?? [])
        .filter(p => (p.roles as string[] | null)?.some(r => r.startsWith('cs_')))
        .map(p => ({
          id:        p.id,
          full_name: p.full_name,
          email:     p.email,
        }))
    : [
        {
          id:        profile.id,
          full_name: profile.full_name,
          email:     profile.email,
        },
      ]

  // Ensure current user is in the list for managers
  if (canViewAll && !agents.some(a => a.id === profile.id)) {
    agents.unshift({
      id:        profile.id,
      full_name: profile.full_name,
      email:     profile.email,
    })
  }

  return (
    <TimeClient
      currentUserId={profile.id}
      currentUserName={agentLabel(profile)}
      canViewAll={canViewAll}
      canExport={canExport}
      agents={agents}
      initialActive={active}
      initialLogs={logs}
      initialMonth={month}
      initialYear={year}
    />
  )
}
