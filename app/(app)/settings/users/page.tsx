import { createClient } from '@/lib/supabase/server'
import UsersRolesClient from '@/components/settings/UsersRolesClient'
import styles from '../general.module.css'

export default async function UsersSettingsPage() {
  const supabase = createClient()
  const { data: users } = await supabase
	.from('profiles')
	  .select('id, full_name, email, roles')
	  .not('roles', 'eq', '{}')
	  .order('full_name')
  
  return (
    <div>
      <h2 className={styles.heading}>Users & Roles</h2>
      <UsersRolesClient users={users ?? []} />
    </div>
  )
}
