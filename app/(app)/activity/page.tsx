import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isCrmManager } from '@/lib/roles'
import Topbar from '@/components/layout/Topbar'
import ActivityFeed from '@/components/activity/ActivityFeed'
import RepSelector from '@/components/reports/RepSelector'
import styles from './activity.module.css'

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { rep?: string }
}) {
  const supabase  = createClient()
  const profile   = await getCachedProfile()
  const canSeeAll = isCrmManager(profile)

  const usersResult = canSeeAll
    ? await supabase.from('profiles').select('id, full_name, email, roles').not('roles', 'eq', '{}').order('full_name')
    : await supabase.from('profiles').select('id, full_name, email, roles').eq('id', profile!.id)

  const allUsers = usersResult.data

  const repUsers = (allUsers ?? []).filter(u =>
    (u.roles as string[] ?? []).some(r => String(r).startsWith('crm_'))
  )

  const selectedRepId = searchParams.rep ?? repUsers[0]?.id ?? profile?.id ?? ''

  const { data: activities } = await supabase
    .from('activities')
    .select(`
      id,
      type,
      subject,
      body,
      outcome,
      duration_minutes,
      direction,
      created_at,
      created_by,
      leads (
        id,
        contact_name,
        company_name,
        stage
      )
    `)
    .eq('created_by', selectedRepId)
    .not('type', 'eq', 'stage_change')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <Topbar title="Activity" userName={profile?.full_name ?? undefined} />
      <div className={styles.page}>
        {canSeeAll && repUsers.length > 0 && (
          <div className={styles.topBar}>
            <RepSelector users={repUsers} selectedId={selectedRepId} basePath="/activity" />
          </div>
        )}
        <ActivityFeed activities={(activities ?? []) as any[]} />
      </div>
    </>
  )
}
