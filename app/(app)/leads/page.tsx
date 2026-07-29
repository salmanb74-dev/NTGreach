import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import LeadsTable from '@/components/leads/LeadsTable'
import LeadsExportButton from '@/components/leads/LeadsExportButton'
import LeadsPagination from '@/components/leads/LeadsPagination'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from '@/lib/types'
import styles from './leads.module.css'

const PAGE_SIZE = 25

interface SearchParams {
  q?: string
  stage?: string
  sort?: string
  page?: string
  [key: string]: string | undefined
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const { q, stage, sort = 'newest', page = '1' } = searchParams
  const currentPage = Math.max(1, parseInt(page) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let dataQuery = supabase.from('leads').select('*', { count: 'exact' })

  if (q?.trim()) {
    const filter = `contact_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`
    dataQuery = dataQuery.or(filter)
  }
  if (stage && stage !== 'all') {
    dataQuery = dataQuery.eq('stage', stage)
  }

  if (sort === 'oldest')    dataQuery = dataQuery.order('created_at', { ascending: true })
  else if (sort === 'name') dataQuery = dataQuery.order('contact_name', { ascending: true })
  else                      dataQuery = dataQuery.order('created_at', { ascending: false })
  dataQuery = dataQuery.range(from, to)

  const { data: leads, count: totalCount } = await dataQuery
  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  return (
    <>
      <Topbar title="Leads" />
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <form className={styles.searchForm} action="/leads" method="GET">
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input name="q" defaultValue={q} placeholder="Search by name, company, phone, email, city…" className={styles.searchInput} autoComplete="off" />
              {stage && <input type="hidden" name="stage" value={stage} />}
            </div>
            <select name="stage" defaultValue={stage || 'all'} className={styles.filterSelect}>
              <option value="all">All stages</option>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <select name="sort" defaultValue={sort} className={styles.filterSelect}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </form>
          <div className={styles.actions}>
            <LeadsExportButton q={q} stage={stage} />
            <Link href="/leads/import">
              <Button size="sm" variant="outline">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 5 17 10"/>
                  <line x1="12" y1="5" x2="12" y2="15"/>
                </svg>
                Import
              </Button>
            </Link>
            <Link href="/leads/new">
              <Button size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                New Lead
              </Button>
            </Link>
          </div>
        </div>

        <div className={styles.resultsRow}>
          <span className={styles.resultsCount}>
            {totalCount ?? 0} lead{totalCount !== 1 ? 's' : ''}
            {q && ` matching "${q}"`}
            {stage && stage !== 'all' && ` · ${STAGE_LABELS[stage as PipelineStage] ?? stage}`}
            {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
          </span>
          <Link href="/pipeline" className={styles.kanbanLink}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="5" height="18"/><rect x="9" y="3" width="5" height="12"/><rect x="15" y="3" width="5" height="8"/></svg>
            Kanban view
          </Link>
        </div>

        <LeadsTable leads={leads ?? []} />

        {totalPages > 1 && (
          <LeadsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={searchParams}
          />
        )}
      </div>
    </>
  )
}
