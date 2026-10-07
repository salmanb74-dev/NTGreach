import { assertNoError } from '@/lib/assert'
import type { OpsNestProduct } from '@/lib/ops/product'
import type { AlmaAdminEnv } from '@/lib/alma-admin/types'
import type { RestoAdminEnv } from '@/lib/resto-admin/types'
import { createClient } from '@/lib/supabase/server'

type OpsSubscriptionNotesEnv = RestoAdminEnv | AlmaAdminEnv

function notesTable(product: OpsNestProduct): string {
  return product === 'alma'
    ? 'ops_alma_subscription_notes'
    : 'ops_resto_subscription_notes'
}

/** Reach-only ops notes for a tenant subscription offer. */
export async function getSubscriptionOfferNotes(
  product: OpsNestProduct,
  tenantId: string,
  env: OpsSubscriptionNotesEnv
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(notesTable(product))
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
  product: OpsNestProduct,
  tenantId: string,
  env: OpsSubscriptionNotesEnv,
  offerNotes: string | null
): Promise<string | null> {
  const supabase = await createClient()
  const normalized = offerNotes?.trim() || null

  const { data, error } = await supabase
    .from(notesTable(product))
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
