# Resto Admin Logs API — contract for Nest (prompt for Resto)

Copy everything below the line into a Resto chat / ticket. Reach will wire the Ops **Logs** UI once this endpoint exists.

---

## Prompt for Resto

You are working in **ntg-rms-v2** (Nest BFF). Reach (NTGreach) already has an Ops portal that calls Nest with a shared admin API key (`ADMIN_API_KEY` / `x-api-key`), same as tenants.

### Already shipping (do not break)

```http
GET /api/v1/admin/tenants?q=
x-api-key: <ADMIN_API_KEY>
```

Response: `{ "data": [ { "id", "name", "ownerName", "ownerEmail" } ] }`  
Auth: `AdminApiKeyGuard` — **no restaurant JWT**. Documented in `backend/src/modules/admin/ADMIN_REACH.md`.

### Goal

Add a **list audit logs** endpoint so Reach can show a Logs tab (global + optional per-tenant filter). Reach never talks to Resto Supabase; only Nest.

### Existing data

Table `audit_logs` (migration `154_create_audit_logs.sql`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | required, FK tenants |
| `branch_id` | uuid \| null | |
| `user_id` | uuid \| null | actor in Resto `users` |
| `action_type` | varchar | e.g. `orders.delete_all` |
| `metadata` | jsonb | action-specific payload |
| `created_at` | timestamptz | |

Today almost only `orders.delete_all` writes rows. That is fine for v1 — return whatever exists. Optionally note in docs which actions are audited; expanding writers is a follow-up.

### Implement

**Endpoint**

```http
GET /api/v1/admin/logs
x-api-key: <ADMIN_API_KEY>
```

**Query params**

| Param | Required | Notes |
|---|---|---|
| `tenantId` | no | If set, filter to that tenant UUID. Invalid UUID → `400`. |
| `actionType` | no | Exact match on `action_type` (e.g. `orders.delete_all`). |
| `from` | no | ISO-8601 lower bound on `created_at` (inclusive). |
| `to` | no | ISO-8601 upper bound on `created_at` (inclusive). |
| `limit` | no | Default `50`, max `200`. |
| `cursor` | no | Opaque pagination cursor (see below). Prefer cursor over offset. If easier for v1, `offset` (default `0`) is acceptable — document which you chose. |

**Auth**

Same as tenants: `AdminApiKeyGuard` only. Do **not** require restaurant JWT.

**Response `200`**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "tenantName": "Sunshine Cafe",
      "branchId": "uuid-or-null",
      "userId": "uuid-or-null",
      "userName": "Brian Chesky",
      "userEmail": "owner@example.com",
      "actionType": "orders.delete_all",
      "metadata": { "softDeleted": 12, "tablesFreed": 3, "reason": "..." },
      "createdAt": "2026-08-02T18:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

Field rules:

- Use **camelCase** in JSON (match tenants API).
- `tenantName`: join/lookup `tenants.name` (fallback `"(unnamed)"` or null — prefer a string).
- `userName` / `userEmail`: from `users` when `user_id` is set; otherwise `null`.
- `metadata`: pass through as object (never stringify).
- Order: **`created_at` DESC** (newest first).
- `nextCursor`: string if more rows exist, else `null`. If using `offset`, omit `nextCursor` and instead return `{ "data": [...], "total": number }` **or** keep `{ data, nextCursor: null }` and document that client should bump `offset` when `data.length === limit`.

**Errors** (same shape as other admin routes)

```json
{ "error": "Human-readable message" }
```

| Status | When |
|---|---|
| 400 | Bad `tenantId` / dates / limit |
| 401 | Missing/invalid `x-api-key` |
| 500 | Unexpected DB / server error |

### Out of scope for this task

- Writing more audit events (nice later; not required to ship the list API)
- Realtime / websocket logs
- Reach UI (Reach team will build after this ships)
- Mutations / delete logs

### Deliverables from Resto

1. Nest route + service under existing `admin` module.
2. Update `backend/src/modules/admin/ADMIN_REACH.md` with this endpoint (request/response examples).
3. Confirm Staging (and Prod if ready) has `ADMIN_API_KEY` set and matches Reach’s `RESTO_*_ADMIN_API_KEY`.
4. Paste back to Reach:
   - Final path + query param names (confirm `tenantId` vs `tenant_id`)
   - Exact response JSON example from a real Staging call (even if `data: []`)
   - Pagination choice (`cursor` vs `offset`)
   - Any deviations from this contract

### Smoke test (Resto)

```bash
curl -sS -H "x-api-key: $ADMIN_API_KEY" \
  "$BASE_URL/api/v1/admin/logs?limit=10"
```

Optional:

```bash
curl -sS -H "x-api-key: $ADMIN_API_KEY" \
  "$BASE_URL/api/v1/admin/logs?tenantId=<uuid>&limit=20"
```

Expect `200` + `{ "data": [ ... ] }` (array may be empty).

---

## Reach status

Implemented:

- Proxy: `GET /api/ops/logs?env=staging|production&tenantId=&actionType=&from=&to=&cursor=&limit=`
- UI: Ops sidebar **Logs** — Staging/Production toggle, tenant/action filters, cursor **Load more**
- Confirmed Nest reply: camelCase query params, `{ data, nextCursor }`, no contract deviations

Optional later: tenant detail → **Logs** tab with `tenantId` fixed.
