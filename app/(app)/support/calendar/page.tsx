import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, isCsAdmin } from '@/lib/roles'
import { modulesForProfile } from '@/lib/platform/access-model'
import type { UserRole } from '@/lib/roles'
import { getCurrentOnDuty } from '@/lib/actions/support-shifts'
import CalendarClient from '@/components/support/CalendarClient'
import type { Module } from '@/lib/modules'
import {
  csModuleForProduct,
  productFromCsModule,
  type SupportProduct,
} from '@/lib/support/product'
import {
  agentDisplayName,
  type ShiftAgent,
  type ShiftItem,
} from '@/lib/support/shifts'

export default async function SupportCalendarPage() {
  const supabase = createClient()
  const now = new Date()

  const profile = await getCachedProfile()
  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule: Module = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? modules[0]
  )!

  const product = productFromCsModule(activeModule)
  if (!product) {
    return (
      <p style={{ padding: '1.5rem', color: 'var(--color-text-muted)' }}>
        Select Support Resto or Support Alma to view the roster.
      </p>
    )
  }

  // Wide window so week navigation still has shift data
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 14, 0, 23, 59, 59, 999)

  const [onDuty, { data: shiftRows }, { data: profiles }] = await Promise.all([
    getCurrentOnDuty(product),
    supabase
      .from('support_shifts')
      .select('id, agent_id, start_at, end_at, created_by, created_at, series_id, product')
      .eq('product', product)
      .gte('end_at', rangeStart.toISOString())
      .lte('start_at', rangeEnd.toISOString())
      .order('start_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, email, roles, products')
      .not('roles', 'eq', '{}')
      .order('full_name'),
  ])

  const csModule = csModuleForProduct(product)
  const agents: ShiftAgent[] = (profiles ?? [])
    .filter(p => {
      const roles = ((p.roles as string[] | null) ?? []) as UserRole[]
      const products = (p.products as string[] | null) ?? []
      if (!roles.some(r => r.startsWith('cs_'))) return false
      return modulesForProfile(roles, products).includes(csModule)
    })
    .map(p => ({
      id:        p.id,
      full_name: p.full_name,
      email:     p.email,
      roles:     (p.roles as string[]) ?? [],
    }))

  const nameById = new Map(
    agents.map(a => [a.id, agentDisplayName(a)])
  )

  // Resolve names for agents who may no longer have this module but have shifts
  const missingIds = [...new Set((shiftRows ?? []).map(s => s.agent_id))]
    .filter(id => !nameById.has(id))

  if (missingIds.length > 0) {
    const { data: extras } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', missingIds)
    for (const p of extras ?? []) {
      nameById.set(p.id, agentDisplayName(p))
    }
  }

  const shifts: ShiftItem[] = (shiftRows ?? []).map(s => ({
    id:         s.id,
    agent_id:   s.agent_id,
    agent_name: nameById.get(s.agent_id) ?? 'Agent',
    start_at:   s.start_at,
    end_at:     s.end_at,
    created_by: s.created_by,
    created_at: s.created_at,
    series_id:  (s as { series_id?: string | null }).series_id ?? null,
    product:    (s.product as SupportProduct) ?? product,
  }))

  return (
    <CalendarClient
      initialShifts={shifts}
      agents={agents}
      onDuty={onDuty}
      canManage={isCsAdmin(profile)}
      product={product}
    />
  )
}
