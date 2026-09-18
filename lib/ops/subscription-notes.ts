import { assertNoError } from '@/lib/assert'
import type { RestoAdminEnv } from '@/lib/resto-admin/types'
import { createClient } from '@/lib/supabase/server'

/** Reach-only ops notes for a Resto tenant subscription offer. */
export async function getSubscriptionOfferNotes(
  tenantId: string,
  env: RestoAdminEnv
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ops_resto_subscription_notes')
    .select('offer_notes')
    .eq('tenant_id', tenantId)
    .eq('env', env)
    .maybeSingle()

  assertNoError(error, 'Failed to load subscription notes')
  if (!data?.offer_notes) return null
  const trimmed = String(data.offer_notes).trim()
  return trimmed || null
}

export async function upsertSubscriptionOfferNotes(
  tenantId: string,
  env: RestoAdminEnv,
  offerNotes: string | null
): Promise<string | null> {
  const supabase = await createClient()
  const normalized = offerNotes?.trim() || null

  const { data, error } = await supabase
    .from('ops_resto_subscription_notes')
    .upsert(
      {
        tenant_id: tenantId,
        env,
        offer_notes: normalized,
      },
      { onConflict: 'tenant_id,env' }
    )
    .select('offer_notes')
    .single()

  assertNoError(error, 'Failed to save subscription notes')
  if (!data?.offer_notes) return null
  const trimmed = String(data.offer_notes).trim()
  return trimmed || null
}
