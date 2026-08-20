# Subscription quote parameters (CRM ↔ templates)

## Labels

| UI | Template token |
|---|---|
| Platform fee / month | `{{platform_fee}}` |
| Platform fee billed | `{{platform_fee_invoice}}` |
| Billing cycle suffix | `{{billing_cycle}}` |
| Duration in months | `{{duration_months}}` |
| Setup fee | `{{setup_fee}}` |
| Pre-trial setup | `{{pre_trial_setup_fee}}` |
| Post-trial setup | `{{post_trial_setup_fee}}` |
| Web ordering setup | `{{web_ordering}}` |
| Web ordering revenue % | `{{web_ordering_revenue_pct}}` |
| Branches | `{{branches}}` |
| Call center / mo | `{{call_center}}` |
| Kitchen display / mo | `{{kds}}` |
| Inventory / mo | `{{inventory}}` |
| Ops support / mo | `{{ops_support}}` |
| Trial starts | `{{trial_starts}}` |

`quoted_mrr` is the **total monthly** recurring (base platform fee + enabled monthly feature fees). Web ordering setup is one-time and is **not** included. Billing cycle comes from Lists & Values (`billing_cycle`): **value** = months (`1`, `12`), **label** = suffix (`per month`, `per year`). Stored on the lead as `payment_frequency` / `quoted_subscription.durationMonths`.

Use `{{platform_fee_invoice}}` in quotations/contracts (includes currency, billed amount, and monthly breakdown when the cycle is longer than a month):

```text
{{platform_fee_invoice}}
```

→ `US$ 27 per month` or `US$ 324 per year (US$ 27/month × 12)`

Feature add-ons (call center, KDS, inventory, ops support): enable + monthly `$`. Off → row omitted from PDF. Web ordering is a one-time setup fee plus optional `webOrderingRevenuePercent` for month-end invoice revenue share (Nest billing not wired yet).

## Formulas

Both quotation and contract templates support simple math:

```text
{{= platform_fee + call_center + kds }}
{{= setup_fee + platform_fee }}
{{= round(platform_fee * duration_months, 2)}}
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
