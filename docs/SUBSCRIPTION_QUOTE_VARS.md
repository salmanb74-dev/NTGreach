# Subscription quote parameters (CRM ↔ templates)

## Labels

| UI | Template token |
|---|---|
| Platform fee (base / mo) | `{{platform_fee}}` |
| Platform fee total / mo (base + add-ons) | `{{platform_fee_total}}` |
| Billing cycle (Monthly / Annual) | `{{billing_cycle}}` |
| Setup fee | `{{setup_fee}}` |
| Branches | `{{branches}}` |
| Call center / mo | `{{call_center}}` |
| Kitchen display / mo | `{{kds}}` |
| Inventory / mo | `{{inventory}}` |
| Ops support / mo | `{{ops_support}}` |
| Web ordering / mo | `{{web_ordering}}` |
| Web ordering revenue % | `{{web_ordering_revenue_pct}}` |
| Trial starts | `{{trial_starts}}` |

`quoted_mrr` is the **total monthly** recurring (base platform fee + enabled feature fees). Billing cycle is `payment_frequency` (`monthly` \| `annual`); term months are derived (1 or 12).

Feature add-ons (call center, KDS, inventory, ops support, web ordering): enable + monthly `$`. Off → template shows `No`. Web ordering also stores `webOrderingRevenuePercent` for month-end invoice revenue share (Nest billing not wired yet).

Backfill: `supabase/deal_values_billing_cycle.sql`
