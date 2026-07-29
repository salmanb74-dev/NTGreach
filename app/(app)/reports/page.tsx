import { createClient } from '@/lib/supabase/server'
import { isCrmManager } from '@/lib/roles'
import Topbar from '@/components/layout/Topbar'
import RepSelector from '@/components/reports/RepSelector'
import PerformanceReport from '@/components/reports/PerformanceReport'
import CurrencySwitcher from '@/components/ui/CurrencySwitcher'
import { getAppSettings, getCurrentRates, getRecentRateHistory, getCachedProfile } from '@/lib/dataCache'
import styles from './reports.module.css'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { rep?: string; currency?: string }
}) {
  const supabase  = createClient()
  const profile   = await getCachedProfile()
  const canSeeAll = isCrmManager(profile)

  // ── Parallel fetch — profile/settings/rates from cache ────────
  const [
    { data: allUsers },
    settingsMap,
    ratesList,
  ] = await Promise.all([

	canSeeAll
	  ? supabase.from('profiles').select('id, full_name, email, roles').not('roles', 'eq', '{}').order('full_name').order('full_name')
	  : supabase.from('profiles').select('id, full_name, email, roles').eq('id', profile!.id),  
    getAppSettings(),
    getCurrentRates(),
  ])

  // ── Derived values ─────────────────────────────────────────
  const repUsers = (allUsers ?? []).filter(u =>
    (u.roles as string[] ?? []).some(r =>
      r === 'crm_sales_rep' || r === 'crm_manager' || r === 'crm_admin'
    )
  )
  const selectedRepId    = searchParams.rep ?? repUsers[0]?.id ?? profile?.id ?? ''
  const inputCurrency    = settingsMap['input_currency']  ?? 'PKR'
  const viewCurrencies   = (settingsMap['view_currencies'] ?? inputCurrency).split(',').map(c => c.trim())
  const selectedCurrency = searchParams.currency && viewCurrencies.includes(searchParams.currency)
    ? searchParams.currency
    : viewCurrencies[0]

  // ── Rate history + rep leads — merged single leads query ──────
  const [historyList, { data: repLeads }, { data: targets }] = await Promise.all([
    getRecentRateHistory(inputCurrency, viewCurrencies),
    supabase.from('leads')
      .select('id, stage, quoted_setup_fee, quoted_mrr, payment_frequency, payment_start_date, closed_at, created_by')
      .eq('created_by', selectedRepId),
    supabase.from('targets').select('*').eq('user_id', selectedRepId)
      .order('start_date', { ascending: false }),
  ])

  // Filter client-side instead of two separate queries
  const allLeads    = repLeads ?? []
  const closedLeads = allLeads.filter(l => l.stage === 'closed_won' && l.closed_at)

  const selectedUser = repUsers.find(u => u.id === selectedRepId) ?? repUsers[0]

  return (
    <>
      <Topbar title="Reports" userName={profile?.full_name ?? undefined} />
      <div className={styles.page}>
        <div className={styles.topBar}>
          {canSeeAll && repUsers.length > 0 && (
            <RepSelector users={repUsers} selectedId={selectedRepId} />
          )}
          {viewCurrencies.length > 1 && (
            <CurrencySwitcher
              viewCurrencies={viewCurrencies}
              selected={selectedCurrency}
              rates={ratesList}
            />
          )}
        </div>

        <PerformanceReport
          user={selectedUser}
          targets={targets ?? []}
          closedLeads={closedLeads}
          allLeads={allLeads}
          currency={selectedCurrency}
          inputCurrency={inputCurrency}
          rates={ratesList}
          rateHistory={historyList}
        />
      </div>
    </>
  )
}
