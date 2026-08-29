import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import CurrencySwitcher from '@/components/ui/CurrencySwitcher'
import CrmDashboardClient from '@/components/dashboard/CrmDashboardClient'
import { buildWeeklyLeadData } from '@/lib/dashboard/weekly-leads'
import { getAppSettings, getCurrentRates, getCachedProfile } from '@/lib/dataCache'
import { getModuleHomePath, pickDefaultModule, type Module } from '@/lib/modules'
import { getAccessibleModules } from '@/lib/roles'
import styles from '@/components/dashboard/dashboard.module.css'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { currency?: string }
}) {
  const profile = await getCachedProfile()
  const accessible = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule =
    saved && accessible.includes(saved) ? saved : pickDefaultModule(accessible)

  if (!activeModule?.startsWith('crm_')) {
    const fallback = pickDefaultModule(accessible)
    redirect(fallback ? getModuleHomePath(fallback) : '/ops')
  }

  const supabase = createClient()

  const [
    settingsMap,
    ratesList,
    { data: allLeads },
    { data: activities },
    { data: meetings },
  ] = await Promise.all([
    getAppSettings(),
    getCurrentRates(),
    supabase.from('leads').select(
      `id, stage, created_at, quoted_setup_fee, quoted_mrr, payment_frequency,
       payment_start_date, deal_currency, quoted_subscription`
    ),
    supabase.from('activities').select('type, lead_id, created_at'),
    supabase.from('meetings').select('lead_id, created_at'),
  ])

  const userName = profile?.full_name ?? profile?.email ?? 'User'

  const inputCurrency  = settingsMap['input_currency']  ?? 'PKR'
  const viewCurrencies = (settingsMap['view_currencies'] ?? inputCurrency).split(',').map(c => c.trim())
  const selectedCurrency = searchParams.currency && viewCurrencies.includes(searchParams.currency)
    ? searchParams.currency
    : viewCurrencies[0]

  const weeklyData = buildWeeklyLeadData(allLeads ?? [], 16)

  return (
    <>
      <Topbar
        title="Dashboard"
        userName={userName}
        modules={accessible}
        activeModule={activeModule}
      />
      <div className={styles.page}>

        <CurrencySwitcher
          viewCurrencies={viewCurrencies}
          selected={selectedCurrency}
          rates={ratesList}
        />

        <CrmDashboardClient
          leads={allLeads ?? []}
          activities={activities ?? []}
          meetings={meetings ?? []}
          weeklyData={weeklyData}
          inputCurrency={inputCurrency}
          selectedCurrency={selectedCurrency}
          rates={ratesList}
        />

      </div>
    </>
  )
}
