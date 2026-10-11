import { getCashTenant } from '@/lib/actions/ops-cash'
import {
  cashDefaultsDiffer,
  cashDefaultsFromSubscription,
  type CashProduct,
} from '@/lib/ops/cash-collection'

/** Append a Cash sync hint when enterprise terms diverge from enabled cash settings. */
export async function cashSyncHintAfterSubscriptionSave(
  tenantId: string,
  product: CashProduct,
  subscription: Record<string, unknown> | null | undefined
): Promise<string | null> {
  if (!subscription) return null
  try {
    const cash = await getCashTenant(tenantId, product)
    if (!cash.settings?.enabled) return null
    const defaults = cashDefaultsFromSubscription(subscription)
    if (!cashDefaultsDiffer(cash.settings, defaults)) return null
    return 'Cash defaults differ — open the Cash tab and Sync from subscription.'
  } catch {
    return null
  }
}
