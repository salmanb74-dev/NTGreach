# Alma Admin Enterprise subscription — Reach integration

Auth: Nest admin calls use `x-api-key` via `ALMA_*_ADMIN_API_KEY`.

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

### PUT body (full replace — every key required)

```
price, durationMonths, setupFee,
branches, students, storageGb,
fees, library, behavioural, uniformInventory, whiteLabel, googleClassroom,
feesMonthly, libraryMonthly, behaviouralMonthly,
uniformInventoryMonthly, whiteLabelMonthly, googleClassroomMonthly,
paidTrial, paidTrialDays, preTrialSetupFee, postTrialSetupFee,
accessStartsAt, trialStartsAt, prorateBackdatedAccess, enterpriseEnabled
```

| Key | Type | Notes |
|---|---|---|
| `branches` / `students` / `storageGb` | `number \| null` | `null` = unlimited |
| Feature flags | `boolean \| null` | Paid add-ons |
| `*Monthly` | `number \| null` | USD / month when add-on on; `null` when off |
| Trial / access fields | same semantics as Resto Enterprise | See Resto subscription contract |

Writes Enterprise **offer** (`enterprise_*`) only. Live entitlements =
`current_enterprise_*` after accept / Apply terms.

### Snapshot fields (GET)

Offer: `enterpriseBranchesLimit`, `enterpriseStudentsLimit`,
`enterpriseStorageGbLimit`, `enterpriseFeesEnabled`, …,
`enterpriseFeesMonthly`, …

Live: `currentEnterpriseBranchesLimit`, …, `currentEnterpriseFeesMonthly`, …

Also: `setupFeePaidUsd`, `firstSubscriptionStartDate` (read-only, never on PUT).

### DELETE

Clears pending offer only. `409` → need `force=true` when already on Enterprise /
`current_enterprise_price` set.

## Reach proxies

| Reach | Nest |
|---|---|
| `GET /api/ops/alma/tenants/:id/subscription?env=` | GET …/subscription |
| `PUT /api/ops/alma/tenants/:id/subscription/enterprise?env=` | PUT …/enterprise |
| `DELETE /api/ops/alma/tenants/:id/subscription/enterprise?env=&force=` | DELETE …/enterprise |

Internal notes: Reach Supabase `ops_alma_subscription_notes` (not Nest).
