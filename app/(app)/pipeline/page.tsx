import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import KanbanBoard from '@/components/leads/KanbanBoard'
import Link from 'next/link'
import styles from './pipeline.module.css'

export default async function PipelinePage() {
  const supabase = createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <>
      <Topbar title="Pipeline" />
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Link href="/leads" className={styles.viewLink}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            List view
          </Link>
        </div>
        <KanbanBoard initialLeads={leads ?? []} />
      </div>
    </>
  )
}
