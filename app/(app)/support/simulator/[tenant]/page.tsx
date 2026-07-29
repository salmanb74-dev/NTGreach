import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin } from '@/lib/roles'
import SimulatorClient from '@/components/support/SimulatorClient'
import {
  getSimulatorTenant,
  mapConversationRow,
  sortConversationsByActivity,
  type ConversationItem,
} from '@/components/support/types'

interface Props {
  params: { tenant: string }
}

export default async function SupportSimulatorTenantPage({ params }: Props) {
  const tenant = getSimulatorTenant(params.tenant)
  if (!tenant) notFound()

  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) redirect('/support/chats')

  const supabase = createClient()

  const { data: conversations } = await supabase
    .from('support_conversations')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const items: ConversationItem[] = sortConversationsByActivity(
    (conversations ?? []).map(c => mapConversationRow(c as Record<string, unknown>))
  )

  return (
    <SimulatorClient
      initialConversations={items}
      currentUserId={profile!.id}
      tenantId={tenant.id}
      tenantName={tenant.name}
      customerDisplayName={tenant.customerSenderName}
    />
  )
}
