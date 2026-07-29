import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import ProfileClient from '@/components/settings/ProfileClient'
import styles from './profile.module.css'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles')
    .eq('id', user!.id)
    .single()

  return (
    <>
      <Topbar title="Profile" userName={profile?.full_name ?? undefined} />
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.heading}>Your Profile</h2>
          <ProfileClient profile={profile} />
        </div>
      </div>
    </>
  )
}
