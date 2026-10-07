# Alma Admin indefinite assessments-creation lock — Reach integration

Auth: same as other Ops Nest calls (`x-api-key` via `ALMA_*_ADMIN_API_KEY`).

Mirrors Resto **orders-lock**, but blocks **creating new assessments**.

## Nest

```http
GET /api/v1/admin/tenants?q=
x-api-key: <ADMIN_API_KEY>
```

Each list row includes:

```json
{ "assessmentsCreationLocked": true }
```

```http
GET /api/v1/admin/tenants/:tenantId/assessments-lock
x-api-key: <ADMIN_API_KEY>
```

```json
{
  "tenantId": "uuid",
  "tenantName": "School",
  "subdomain": "school",
  "locked": true,
  "lockedAt": "2026-10-01T07:00:00.000Z",
  "reason": "Non-payment"
}
```

`lockedAt` / `reason` are `null` when unlocked. `reason` is ops-only.

```http
PUT /api/v1/admin/tenants/:tenantId/assessments-lock
x-api-key: <ADMIN_API_KEY>
Content-Type: application/json
```

Lock:

```json
{ "locked": true, "reason": "Non-payment" }
```

Unlock:

```json
{ "locked": false }
```

Response: same fields as GET, plus `"changed": true|false`.

| Status | When |
|---|---|
| 400 | Invalid UUID / missing `locked` |
| 401 | Bad API key |
| 404 | Tenant not found |
| 503 | Nest `ADMIN_API_KEY` not set |

## Reach proxies

| Reach | Nest |
|---|---|
| `GET /api/ops/alma/tenants?env=` | List (includes `assessmentsCreationLocked`) |
| `GET /api/ops/alma/tenants/:id/assessments-lock?env=` | GET …/assessments-lock |
| `PUT /api/ops/alma/tenants/:id/assessments-lock?env=` | PUT …/assessments-lock |

## UI

- Tenants list: lock icon when `assessmentsCreationLocked` is true
- Tenant detail → Overview: **Lock Assessments** / **Unlock Assessments**
- Lock requires typing school/tenant name + tenant id; optional reason
