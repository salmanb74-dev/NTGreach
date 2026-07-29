import { createClient } from '@/lib/supabase/server'
import EnumerationsClient from '@/components/settings/EnumerationsClient'
import styles from '../general.module.css'

const CATEGORIES = [
  { key: 'company_type', label: 'Company Types' },
  { key: 'lead_source',  label: 'Lead Sources'  },
  { key: 'city',         label: 'Cities'         },
  { key: 'currency',     label: 'Currencies'     },
]

export default async function EnumerationsPage() {
  const supabase = createClient()
  const { data: enums } = await supabase
    .from('enumerations')
    .select('*')
    .order('sort_order')

  const grouped: Record<string, typeof enums> = {}
  CATEGORIES.forEach(c => {
    grouped[c.key] = (enums ?? []).filter(e => e.category === c.key)
  })

  return (
    <div>
      <h2 className={styles.heading}>Lists & Values</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24, lineHeight: 1.5 }}>
        Manage the dropdown options used throughout NTG Reach. Changes take effect immediately.
      </p>
      <EnumerationsClient grouped={grouped} categories={CATEGORIES} />
    </div>
  )
}
