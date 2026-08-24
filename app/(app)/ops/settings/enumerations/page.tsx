import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isPlatformOpsAdmin } from '@/lib/roles'
import OpsEnumerationsClient from '@/components/ops/OpsEnumerationsClient'
import { OPS_DOC_ENUM_CATEGORIES } from '@/lib/ops-docs/types'
import type { OpsEnumeration } from '@/lib/ops-docs/types'
import styles from './settings.module.css'

export default async function OpsSettingsEnumerationsPage() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) redirect('/ops')

  const supabase = createClient()
  const { data: enums } = await supabase
    .from('ops_enumerations')
    .select('*')
    .order('sort_order', { ascending: true })

  const rows = (enums ?? []) as OpsEnumeration[]
  const categories = [...OPS_DOC_ENUM_CATEGORIES]
  const grouped: Record<string, OpsEnumeration[]> = {}
  for (const c of categories) {
    grouped[c.key] = rows.filter(e => e.category === c.key)
  }

  return (
    <div>
      <h2 className={styles.heading}>Lists &amp; Values</h2>
      <p className={styles.intro}>
        Manage Doc categories and subcategories for platform Ops. These are
        separate from CRM Lists &amp; Values.
      </p>
      <OpsEnumerationsClient grouped={grouped} categories={[...categories]} />
    </div>
  )
}
