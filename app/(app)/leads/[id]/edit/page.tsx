import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import LeadForm from '@/components/leads/LeadForm'
import { getFormEnumerations } from '@/lib/enumerations'
import Link from 'next/link'
import styles from '../../new/new.module.css'

export default async function EditLeadPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: lead }, { companyTypes, leadSources, cities }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', params.id).single(),
    getFormEnumerations(),
  ])
  if (!lead) notFound()

  return (
    <>
      <Topbar title="Edit Lead" />
      <div className={styles.page}>
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 className={styles.heading} style={{ margin: 0 }}>Edit — {lead.contact_name}</h2>
            <Link href={`/leads/${lead.id}`} style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>← Back to lead</Link>
          </div>
          <LeadForm
            lead={lead}
            companyTypes={companyTypes}
            leadSources={leadSources}
            cities={cities}
          />
        </div>
      </div>
    </>
  )
}
