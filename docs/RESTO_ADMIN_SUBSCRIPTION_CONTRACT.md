# Resto Admin Enterprise subscription — Reach integration

Auth: same as other Ops Nest calls (`x-api-key` via `RESTO_*_ADMIN_API_KEY`).

## Nest

```http
GET /api/v1/admin/tenants/:tenantId/subscription
x-api-key: <ADMIN_API_KEY>
```

```http
PUT /api/v1/admin/tenants/:tenantId/subscription/enterprise
x-api-key: <ADMIN_API_KEY>
Content-Type: application/json
```

```http
DELETE /api/v1/admin/tenants/:tenantId/subscription/enterprise?force=true
x-api-key: <ADMIN_API_KEY>
Content-Type: application/json

{ "force": true }
```

### GET

`subscription.setupFeePaidUsd` — lifetime setup fees paid to date (USD): regular + pre-trial + post-trial already collected (`setup_fee_paid_usd`). **Read-only** (never on PUT). Future checkout charges `max(0, new list setup − this balance)`. Display only — do not invent client-side.

### PUT body

Full replace — every key required:

```
price, durationMonths, setupFee, locations, users, counters, ordersPerMonth,
callCenter, kds, inventory, support, webOrdering, paidTrial, paidTrialDays,
preTrialSetupFee, postTrialSetupFee, accessStartsAt, trialStartsAt,
prorateBackdatedAccess, enterpriseEnabled
```

Reach Ops UI now:
- Sends `paidTrialDays: null` always (trial length not collected).
- Sends `postTrialSetupFee: 0` always (post-trial setup dropped).
- **`trialStartsAt`**: required when `paidTrial=true`; past or future OK. Sent on Subscription too when present (historical). GET: `enterpriseTrialStartsAt`.
- **`accessStartsAt`** (Subscription start): optional on Trial (planned convert date); required when `paidTrial=false`. Past or future OK.
- **`prorateBackdatedAccess`**: Subscription only. `true` (default) = Stripe prorates accept→next renewal on the `accessStartsAt` calendar day; `false` = charge full duration period(s) from `accessStartsAt` through that renewal. Ignored when `accessStartsAt` is empty/future (Reach still sends `true`). Trial PUT sends `null`. GET may be `null` on trial/unset.
- On Trial (`paidTrial: true`): still sends `price`, `durationMonths`, `setupFee` as **planned subscription** terms for later convert (not charged until activation).
- On Subscription: `preTrialSetupFee` forced to `0`.
- **Internal notes**: Reach-only (Supabase `ops_resto_subscription_notes`); **not** on Nest PUT.

Writes Enterprise **offer** (`enterprise_*`) only. Does **not** set `plan_id` to enterprise. Activation = portal checkout / Billing “Apply new terms”. Live = `current_enterprise_*`.

**Trial acceptance (Reach UI):** Nest may activate Ent/Trial (`enterpriseInPaidTrial` / `status` trial|trialing, `plan_id` enterprise). On trial, Nest stores the accepted **trial fee** (pre-trial setup) in `current_enterprise_price`. Reach:

- Binds **Current** only to `current_enterprise_*` (+ `trialStartedAt` / period).
- Treats `enterprisePrice` / `enterpriseSetupFee` / duration on Trial as **planned convert FYI** — they do **not** create Pending re-acceptance vs `current_enterprise_price`.
- Shows **Pending re-acceptance** when trial entitlements or pre-trial fee diverge from accepted `current_*` (or when a Subscription offer diverges from live commercial terms).

### Planned Nest fields (Reach UI placeholders — not sent yet)

Reach Ops Subscription UI collects these for parity with CRM Deal Values, but **PUT still sends only the boolean flags** until Nest accepts them:

| Field | Meaning |
|---|---|
| `callCenterFee` | Monthly $ add-on when call center is on |
| `kdsFee` | Monthly $ add-on when KDS is on |
| `inventoryFee` | Monthly $ add-on when inventory is on |
| `supportFee` | Monthly $ add-on when ops/operation support is on |
| `webOrderingFee` | Monthly $ add-on when web ordering is on |
| `webOrderingRevenuePercent` | % of revenue on month-end invoice (web ordering) |

CRM stores the same shape on `leads.quoted_subscription` and uses fees in `quoted_mrr` / quotation templates today.

### DELETE

Cancels a **pending** offer only (clears `enterprise_*`). Does not cancel live plan, `current_enterprise_*`, Stripe, or `setupFeePaidUsd`.

| Response | Meaning |
|---|---|
| `cleared: true` | Pending offer removed |
| `cleared: false` | No pending offer / no sub row |
| `409` | Plan is Enterprise **or** `current_enterprise_price` set → need `?force=true` or body `{ "force": true }` |

## Reach proxies

| Reach | Nest |
|---|---|
| `GET /api/ops/tenants/:id/subscription?env=` | GET …/subscription |
| `PUT /api/ops/tenants/:id/subscription/enterprise?env=` | PUT …/enterprise |
| `DELETE /api/ops/tenants/:id/subscription/enterprise?env=&force=` | DELETE …/enterprise |

## UI

- GET → form → PUT full payload
- **Offer type** toggle: **Trial** (`paidTrial: true`) | **Subscription** (`paidTrial: false`)
- On Trial: **Trial start** required; **Subscription start** optional (planned convert). Limits/features + pre-trial setup apply now; Recurring / Duration / Term total / Setup fee are **planned** (saved for convert, not charged on trial). Trial is **open-ended** (no trial days) until ops converts to Subscription / Apply terms.
- On Subscription: **Subscription start** required; **Trial start** shown disabled (historical). Commercial fields apply; pre-trial setup disabled (sent as `0`)
- **Backdated start billing** (Subscription only): shown when `accessStartsAt` is set and ≤ today (UTC). Radios: Prorate to next renewal (`true`, default) | Charge full period(s) from start date (`false`). Hidden on Trial / future start (PUT still sends `true` on Subscription, `null` on Trial).
- Both start dates: past or future allowed (no min/max)
- **Internal notes** → Reach Supabase only (`GET/PUT /api/ops/tenants/:id/subscription-notes`)
- **Duration** = cycle select → `durationMonths` 1 / 3 / 6 / 12 / 24
- Dropped from UI: trial days, post-trial setup (still sent as `paidTrialDays: null`, `postTrialSetupFee: 0`)
- Locations (not Branches)
- Show `setupFeePaidUsd` as **Total setup fees paid** (both columns / reference; read-only)
- **Cancel pending offer** → DELETE (force when tenant already on Enterprise / accepted terms)
- Surface `notes[]` and `subscription.warnings[]`

### Setup fees (UI semantics)

- New setup / pre-trial amounts are **charges for this offer** (setup fee on Trial = planned convert charge).
- **0** = no charge this time (not highlighted as a change).
- **Any amount > 0** = will bill / is planned; row is highlighted.
- Subscription mode → pre-trial setup forced to `0` on PUT.
