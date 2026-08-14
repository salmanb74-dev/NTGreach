# Subscription quote parameters (CRM ↔ templates)

## Labels

| UI | Template token |
|---|---|
| Platform fee | `{{platform_fee}}` |
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

Feature add-ons (call center, KDS, inventory, ops support, web ordering): enable + monthly `$`. Off → row omitted from PDF. Web ordering also stores `webOrderingRevenuePercent` for month-end invoice revenue share (Nest billing not wired yet).

## Formulas

Both quotation and contract templates support simple math:

```text
{{= platform_fee + call_center + kds }}
{{= setup_fee + platform_fee }}
{{= round(platform_fee * 12, 2) }}
{{= if(call_center > 0, call_center, 0) }}
```

- Operators: `+` `-` `*` `/`, comparisons (`>`, `>=`, `<`, `<=`, `==`, `!=`), parentheses
- Variable names are the same tokens as above (blank / “No” / null → `0`)
- `round(x)` or `round(x, digits)` (digits 0–8)
- `if(condition, then, else)` — condition is true when the value is not `0`
- Invalid formulas highlight in red in preview

## Conditionals (currency prefix, optional text)

Show content only when a value is present / greater than zero:

```text
{{#if platform_fee > 0}}{{currency}} {{platform_fee}}{{/if}}
{{#if call_center}}{{currency}} {{call_center}}{{/if}}
{{#if setup_fee > 0}}Setup: {{currency}} {{setup_fee}}{{else}}No setup fee{{/if}}
```

- Blank, null, and `0` are falsy (block is omitted)
- Optional `{{else}}…` branch
- Nested `{{#if}}` is supported

Backfill: `supabase/deal_values_billing_cycle.sql`
