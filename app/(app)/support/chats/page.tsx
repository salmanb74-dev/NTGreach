import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { getAccessibleModules } from '@/lib/roles'
import ConversationList from '@/components/support/ConversationList'
import {
  groupConversationsByTenant,
  mapConversationRow,
  type ConversationItem,
} from '@/components/support/types'
import type { Module } from '@/lib/modules'

/** Map a cs_* module to the product value stored in support_conversations. */
function productForModule(mod: Module): 'resto' | 'alma' | null {
  if (mod === 'cs_resto') return 'resto'
  if (mod === 'cs_alma') return 'alma'
  return null
}

export default async function SupportChatsPage() {
  const supabase = createClient()

  const profile = await getCachedProfile()
  const modules = getAccessibleModules(profile)
  const saved = cookies().get('ntg-active-module')?.value as Module | undefined
  const activeModule: Module = (
    saved && modules.includes(saved) && saved.startsWith('cs_')
      ? saved
      : modules.find(m => m.startsWith('cs_')) ?? modules[0]
  )!

  const product = productForModule(activeModule)

  let query = supabase
    .from('support_conversations')
    .select('*, support_messages(count)')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (product) query = query.eq('product', product)

  const [{ data: conversations }] = await Promise.all([query])

  const rows = conversations ?? []
  const agentIds = [
    ...new Set(
      rows
        .flatMap(c => [c.assigned_to, c.created_by])
        .filter((id): id is string => !!id)
    ),
  ]

  const { data: agents } = agentIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', agentIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] }

  const agentNames: Record<string, string> = {}
  for (const a of agents ?? []) {
    agentNames[a.id] = a.full_name?.trim() || a.email || 'Unknown'
  }

  const items: ConversationItem[] = rows.map(c => {
    const msgMeta = c.support_messages as { count?: number }[] | null | undefined
    const count = Array.isArray(msgMeta) ? Number(msgMeta[0]?.count ?? 0) : 0
    const { support_messages: _, ...row } = c as Record<string, unknown> & {
      support_messages?: unknown
    }
    return mapConversationRow(
      row,
      c.assigned_to ? (agentNames[c.assigned_to] ?? null) : null,
      count > 0
    )
  })

  const groups = groupConversationsByTenant(items)

  return (
    <ConversationList
      initialGroups={groups}
      currentUserId={profile!.id}
      currentUserName={profile!.full_name?.trim() || profile!.email || 'Agent'}
    />
  )
}
