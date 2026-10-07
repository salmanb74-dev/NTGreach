# Prompt for Alma Nest — Admin Ops API (mirror Reach Ops Alma)

Copy everything below the line into a chat with the Alma Nest developer.

---

## Goal

Build an **Admin Ops API** on Alma Nest so NTG Reach **Ops Alma** can manage tenants the same way Ops Resto does for Resto — but with **Alma-specific limits, paid add-ons, and an assessments-creation lock**.

Reach already implements the UI and proxies (`/api/ops/alma/*`). Nest must expose matching endpoints authenticated with a server-only `x-api-key` (`ADMIN_API_KEY` / Reach `ALMA_*_ADMIN_API_KEY`).

Reference behaviour on Resto Nest (tenants list, subscription enterprise offer, delete tenant, admin logs). **Do not reuse Resto field names** for entitlements — use the Alma contract below.

Prod base URL Reach will call: `https://alma.ntgapps.com`  
Staging will be added later; support the same routes when staging exists.

---

## Auth

All routes below:

```http
x-api-key: <ADMIN_API_KEY>
```

Return `401` on bad/missing key, `503` if admin key is not configured on Nest.

---

## 1) List tenants

```http
GET /api/v1/admin/tenants
```

Preferred envelope: `{ "data": [ ... ] }` (also accept bare array).

Each row (camelCase preferred; snake_case also OK):

| Field | Type | Notes |
|---|---|---|
| `id` | string | required |
| `name` | string | school / tenant name |
| `ownerName` | string \| null | |
| `ownerEmail` | string \| null | |
| `planId` | string \| null | `free` \| `starter` \| `pro` \| `enterprise` (+ optional suffix) |
| `planStatus` | string \| null | e.g. active / trial |
| `enterpriseInPaidTrial` | boolean \| null | |
| `subscriptionStart` | date \| null | YYYY-MM-DD |
| `firstSubscriptionStartDate` | date \| null | write-once; never editable via admin PUT |
| `trialStartedAt` | date \| null | |
| `billingCycle` | string \| null | e.g. `1_month`, `1_year` |
| `branchesUsed` / `branchesLimit` | number \| null | null limit = unlimited |
| `studentsUsed` / `studentsLimit` | number \| null | |
| `storageGbUsed` / `storageGbLimit` | number \| null | storage in **GB** |
| `assessmentsCreationLocked` | boolean | indefinite ops lock; default false |

**Catalog defaults** (free/starter): branches `1`, students `200`, storageGb `10`.  
Pro suggestion: `3` / `500` / `25`. Enterprise: offer-driven / unlimited.

---

## 2) Subscription + Enterprise offer

```http
GET /api/v1/admin/tenants/:tenantId/subscription
PUT /api/v1/admin/tenants/:tenantId/subscription/enterprise
DELETE /api/v1/admin/tenants/:tenantId/subscription/enterprise?force=true
```

### Model (same as Resto conceptually)

- **Offer** columns (`enterprise_*`): sales terms Reach edits; does **not** by itself change live plan.
- **Live** columns (`current_enterprise_*`): accepted / applied terms.
- Activation = portal checkout / “Apply new terms” (same idea as Resto).
- `setupFeePaidUsd`, `firstSubscriptionStartDate` are **read-only** on GET; never accept on PUT.

### PUT body — full replace, every key required

```json
{
  "price": 420,
  "durationMonths": 12,
  "setupFee": 0,
  "branches": 1,
  "students": 200,
  "storageGb": 10,
  "fees": true,
  "library": false,
  "behavioural": false,
  "uniformInventory": false,
  "whiteLabel": false,
  "googleClassroom": true,
  "feesMonthly": 25,
  "libraryMonthly": null,
  "behaviouralMonthly": null,
  "uniformInventoryMonthly": null,
  "whiteLabelMonthly": null,
  "googleClassroomMonthly": 15,
  "paidTrial": false,
  "paidTrialDays": null,
  "preTrialSetupFee": 0,
  "postTrialSetupFee": 0,
  "accessStartsAt": "2026-04-01",
  "trialStartsAt": null,
  "prorateBackdatedAccess": true,
  "enterpriseEnabled": true
}
```

**Limits only (no users/counters/orders):**

- `branches`, `students`, `storageGb`: `number | null` (`null` = unlimited)

**Paid feature add-ons** (all boolean + monthly USD):

| Flag | Monthly fee key | UI label |
|---|---|---|
| `fees` | `feesMonthly` | Fees |
| `library` | `libraryMonthly` | Library |
| `behavioural` | `behaviouralMonthly` | Behavioural |
| `uniformInventory` | `uniformInventoryMonthly` | Uniform Inventory |
| `whiteLabel` | `whiteLabelMonthly` | White label |
| `googleClassroom` | `googleClassroomMonthly` | Google Classroom |

When a flag is false/off, corresponding `*Monthly` should be `null` (or ignored and stored null). Fees are **recurring $/mo**, not one-time.

**Trial / access** — match Resto Nest semantics:

- `paidTrial`, `paidTrialDays` (Reach sends `paidTrialDays: null`), `preTrialSetupFee`, `postTrialSetupFee` (Reach sends post = `0`)
- `accessStartsAt`, `trialStartsAt`, `prorateBackdatedAccess` (`null` on trial PUT)
- `enterpriseEnabled`

Persist offer fields such as:

- `enterprise_branches_limit`, `enterprise_students_limit`, `enterprise_storage_gb_limit`
- `enterprise_fees_enabled`, … + `enterprise_fees_monthly`, …
- Mirror live accepted values under `current_enterprise_*`

GET response shape:

```json
{
  "tenant": { "id": "...", "name": "...", "email": null, "subdomain": "..." },
  "subscription": { /* plan + enterprise_* + current_enterprise_* + setupFeePaidUsd + firstSubscriptionStartDate + warnings[] */ },
  "notes": []
}
```

DELETE clears **pending offer only**. If plan is already enterprise or `current_enterprise_price` is set, return `409` unless `force=true`.

---

## 3) Assessments creation lock (not orders lock)

Indefinite ops lock that blocks **creating new assessments** for the tenant.

```http
GET /api/v1/admin/tenants/:tenantId/assessments-lock
PUT /api/v1/admin/tenants/:tenantId/assessments-lock
```

GET/PUT response:

```json
{
  "tenantId": "uuid",
  "tenantName": "School",
  "subdomain": "school",
  "locked": true,
  "lockedAt": "2026-10-01T07:00:00.000Z",
  "reason": "Non-payment",
  "changed": true
}
```

PUT body:

- Lock: `{ "locked": true, "reason": "optional ops note" }`
- Unlock: `{ "locked": false }` (clear reason / lockedAt)

List endpoint must include `assessmentsCreationLocked: boolean`.

Enforce the lock in Alma product APIs that create assessments.

---

## 4) Delete tenant

```http
DELETE /api/v1/admin/tenants/:tenantId
Content-Type: application/json

{ "confirmTenantId": "<same uuid>", "confirm": true }
```

Hard-delete tenant + related Alma data. Return `{ deleted, tenantId, tenantName, summary }` with useful counts/warnings. Mirror Resto admin delete safety (confirm id must match).

---

## 5) Admin logs (api_hits)

```http
GET /api/v1/admin/logs?tenantId=&method=&statusCode=&actionType=&cursor=&limit=
```

Return `{ "data": [ hits ], "nextCursor": string | null }` with HTTP traffic metadata (method, url, statusCode, responseTimeMs, bodies optional). Same idea as Resto `api_hits` admin logs.

---

## Out of scope / notes

- Reach stores internal offer notes in its own Supabase (`ops_alma_subscription_notes`) — Nest does not need that.
- Reach Ops Alma and Ops Resto are **fully independent** (separate keys, separate proxies).
- Prefer camelCase JSON; Reach normalizes snake_case too.
- Keep plan catalog in Nest as source of truth for free/starter/pro; Reach mirrors limits for display.

## Acceptance checklist

- [ ] `GET /api/v1/admin/tenants` with usage + `assessmentsCreationLocked`
- [ ] Subscription GET/PUT/DELETE enterprise with Alma limits + 6 add-ons + monthly fees
- [ ] Offer vs live (`enterprise_*` vs `current_enterprise_*`) separation
- [ ] Assessments-lock GET/PUT + product enforcement
- [ ] Tenant DELETE with confirm
- [ ] Admin logs pagination
- [ ] `x-api-key` auth; documented `ADMIN_API_KEY` for Reach `ALMA_PROD_ADMIN_API_KEY`
