import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, isCsAdmin, isCsManager } from '@/lib/roles'
import {
  getSiteVisitCustomers,
  getSiteVisits,
} from '@/lib/actions/support-site-visits'
import SiteVisitsClient from '@/components/support/SiteVisitsClient'
import {
  agentLabel,
  type SiteVisitAgent,
  type SupportProduct,
} from '@/lib/support/site-visits'
import type { Module } from '@/lib/modules'

function productForModule(mod: Module): SupportProduct | null {
  if (mod === 'cs_resto') return 'resto'
  if (mod === 'cs_alma') return 'alma'
  return null
}

export default async function SupportVisitsPage() {
  const supabase = createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const profile = await getCachedProfile()
  if (!profile) return null

  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule: Module = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? modules[0]
  )!

  const product = productForModule(activeModule)
  if (!product) {
    return (
      <p style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
        Select Support Resto or Support Alma to log site visits.
      </p>
    )
  }

  const canViewAll = isCsManager(profile)
  const canEditOthers = isCsAdmin(profile)

  const [visits, customers, { data: profiles }] = await Promise.all([
    getSiteVisits(profile.id, month, year, product),
    getSiteVisitCustomers(product),
    canViewAll
      ? supabase
          .from('profiles')
          .select('id, full_name, email, roles')
          .not('roles', 'eq', '{}')
          .order('full_name')
      : Promise.resolve({ data: null }),
  ])

  const agents: SiteVisitAgent[] = canViewAll
    ? (profiles ?? [])
        .filter(p => (p.roles as string[] | null)?.some(r => r.startsWith('cs_')))
        .map(p => ({
          id:        p.id,
          full_name: p.full_name,
          email:     p.email,
        }))
    : [
        {
          id:        profile.id,
          full_name: profile.full_name,
          email:     profile.email,
        },
      ]

  if (canViewAll && !agents.some(a => a.id === profile.id)) {
    agents.unshift({
      id:        profile.id,
      full_name: profile.full_name,
      email:     profile.email,
    })
  }

  return (
    <SiteVisitsClient
      currentUserId={profile.id}
      currentUserName={agentLabel(profile)}
      canViewAll={canViewAll}
      canEditOthers={canEditOthers}
      product={product}
      agents={agents}
      customers={customers}
      initialVisits={visits}
      initialMonth={month}
      initialYear={year}
    />
  )
}
