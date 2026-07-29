import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, isCrmManager } from '@/lib/roles'
import { redirect } from 'next/navigation'
import ManageTargets from '@/components/reports/ManageTargets'
import styles from '../general.module.css'

export default async function TargetsSettingsPage() {
  const supabase = createClient()
  const profile  = await getCurrentProfile()
  if (!isCrmManager(profile)) redirect('/dashboard')

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles')
    .order('full_name')

  // CRM sales users in the selector (role rename: sales_rep → crm_sales_rep)
  const repUsers = (allUsers ?? []).filter(u =>
    (u.roles as string[] ?? []).some(r =>
      r === 'crm_sales_rep' || r === 'crm_manager' || r === 'crm_admin'
    )
  )

  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .order('start_date', { ascending: false })

  const { data: currencySetting } = await supabase
    .from('app_settings').select('value').eq('key', 'input_currency').single()
  const inputCurrency = currencySetting?.value ?? 'PKR'

  return (
    <div>
      <h2 className={styles.heading}>Manage Targets</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24, lineHeight: 1.5 }}>
        Set performance targets for each sales rep. Amounts are stored in the currency active at time of entry.
      </p>
      <ManageTargets
        users={repUsers}
        targets={targets ?? []}
        selectedRepId={repUsers[0]?.id ?? ''}
        currency={inputCurrency}
      />
    </div>
  )
}
