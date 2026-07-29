import Topbar from '@/components/layout/Topbar'
import LeadForm from '@/components/leads/LeadForm'
import { getFormEnumerations } from '@/lib/enumerations'
import styles from './new.module.css'

export default async function NewLeadPage({ searchParams }: { searchParams: { stage?: string } }) {
  const { companyTypes, leadSources, cities } = await getFormEnumerations()
  return (
    <>
      <Topbar title="New Lead" />
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.heading}>Create a new lead</h2>
          <LeadForm
            initialStage={searchParams.stage}
            companyTypes={companyTypes}
            leadSources={leadSources}
            cities={cities}
          />
        </div>
      </div>
    </>
  )
}
