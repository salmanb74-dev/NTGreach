import Topbar from '@/components/layout/Topbar'
import ImportWizard from '@/components/import/ImportWizard'
import Link from 'next/link'
import styles from './import.module.css'

export default function ImportPage() {
  return (
    <>
      <Topbar title="Import Leads" />
      <div className={styles.page}>
        <div className={styles.header}>
          <Link href="/leads" className={styles.back}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to Leads
          </Link>
          <div>
            <h2 className={styles.title}>Import from Excel</h2>
            <p className={styles.subtitle}>Upload a .xlsx or .csv file — map your columns, preview, then import</p>
          </div>
        </div>
        <ImportWizard />
      </div>
    </>
  )
}
