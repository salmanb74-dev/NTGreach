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

PUT body is a **full replace** — every key required (use `null` only where Nest allows).

| Field | Type |
|---|---|
| price | number > 0 (total for full duration; UI edits monthly × months) |
| durationMonths | integer > 0 |
| setupFee | number ≥ 0 |
| locations, users, counters, ordersPerMonth | positive int \| null |
| callCenter, kds, inventory, support, webOrdering | boolean \| null |
| paidTrial | boolean |
| paidTrialDays | positive int if paidTrial; else null |
| preTrialSetupFee, postTrialSetupFee | number ≥ 0 (Nest columns NOT NULL — send `0`, not null) |
| accessStartsAt | future ISO \| null (not with paidTrial) |
| enterpriseEnabled | boolean |

Does **not** set `plan_id` to enterprise or activate the plan.

## Reach proxies

| Reach | Nest |
|---|---|
| `GET /api/ops/tenants/:id/subscription?env=` | GET …/subscription |
| `PUT /api/ops/tenants/:id/subscription/enterprise?env=` | PUT …/enterprise |

UI: tenant detail → **Subscription** tab. Load → edit offer → save full body. Shows `notes[]` and `subscription.warnings[]`.
