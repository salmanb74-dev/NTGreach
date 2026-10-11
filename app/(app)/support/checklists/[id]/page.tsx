import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules, type Module } from '@/lib/roles'
import { moduleHref } from '@/lib/modules'
import { getChecklistRestaurant } from '@/lib/actions/support-checklists'
import ChecklistDetailClient from '@/components/support/ChecklistDetailClient'

export default async function SupportChecklistDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const profile = await getCachedProfile()
  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? 'cs_resto'
  ) as Module

  let data: Awaited<ReturnType<typeof getChecklistRestaurant>>
  try {
    data = await getChecklistRestaurant(params.id)
  } catch {
    notFound()
  }

  return (
    <ChecklistDetailClient
      restaurant={data.restaurant}
      lines={data.lines}
      listPath={moduleHref(activeModule, 'checklists')}
    />
  )
}
