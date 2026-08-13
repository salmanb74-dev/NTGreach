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
preTrialSetupFee, postTrialSetupFee, accessStartsAt, enterpriseEnabled
```

Writes Enterprise **offer** (`enterprise_*`) only. Does **not** set `plan_id` to enterprise. Activation = portal checkout / Billing “Apply new terms”. Live = `current_enterprise_*`.

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
- Show `setupFeePaidUsd` as **Total setup fees paid** (both columns / reference; read-only)
- **Cancel pending offer** → DELETE (force when tenant already on Enterprise / accepted terms)
- Surface `notes[]` and `subscription.warnings[]`

### Setup fees (UI semantics)

- New setup / pre / post trial amounts are **charges for this offer**.
- **0** = no charge this time (not highlighted as a change).
- **Any amount > 0** = will bill; row is highlighted.
- Trial **off** → only setup fee editable; trial **on** → only pre/post editable.
