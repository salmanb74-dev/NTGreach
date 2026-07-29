import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import Topbar from '@/components/layout/Topbar'
import NotificationsClient from '@/components/notifications/NotificationsClient'
import styles from './notifications.module.css'

export default async function NotificationsPage() {
  const supabase = createClient()
  const profile  = await getCachedProfile()

  const [
    { data: allReminders },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from('reminders')
      .select(`*, leads (id, contact_name, company_name)`)
      .order('remind_at', { ascending: false }),
    supabase
      .from('leads')
      .select('id, contact_name, company_name')
      .order('contact_name'),
  ])

  const now       = new Date().toISOString()
  const active    = (allReminders ?? []).filter(r => !r.dismissed_at)
  const due       = active.filter(r => r.remind_at <= now)
  const upcoming  = active.filter(r => r.remind_at > now)
  const dismissed = (allReminders ?? []).filter(r => r.dismissed_at)

  return (
    <>
      <Topbar title="Notifications" userName={profile?.full_name ?? undefined} />
      <div className={styles.page}>
        <NotificationsClient
          due={due}
          upcoming={upcoming}
          dismissed={dismissed}
          leads={leads ?? []}
        />
      </div>
    </>
  )
}
