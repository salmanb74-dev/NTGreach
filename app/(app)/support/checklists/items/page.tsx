import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, isCsAdmin, type Module } from '@/lib/roles'
import { moduleHref } from '@/lib/modules'
import { listChecklistItems } from '@/lib/actions/support-checklists'
import ChecklistItemsEditor from '@/components/support/ChecklistItemsEditor'

export default async function SupportChecklistItemsPage() {
  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) redirect('/support/checklists')

  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? 'cs_resto'
  ) as Module

  const items = await listChecklistItems()

  return (
    <ChecklistItemsEditor
      initialItems={items}
      listPath={moduleHref(activeModule, 'checklists')}
    />
  )
}
