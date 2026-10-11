import { cookies } from 'next/headers'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, isCsAdmin, type Module } from '@/lib/roles'
import { moduleHref } from '@/lib/modules'
import { listChecklistRestaurants } from '@/lib/actions/support-checklists'
import ChecklistRestaurantsClient from '@/components/support/ChecklistRestaurantsClient'

export default async function SupportChecklistsPage() {
  const profile = await getCachedProfile()
  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? 'cs_resto'
  ) as Module

  const restaurants = await listChecklistRestaurants()
  const canEditItems = isCsAdmin(profile)

  return (
    <ChecklistRestaurantsClient
      initialRestaurants={restaurants}
      basePath={moduleHref(activeModule, 'checklists')}
      itemsPath={moduleHref(activeModule, 'checklists', 'items')}
      canEditItems={canEditItems}
    />
  )
}
