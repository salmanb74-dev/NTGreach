# Resto Admin indefinite order-placement lock — Reach integration

Auth: same as other Ops Nest calls (`x-api-key` via `RESTO_*_ADMIN_API_KEY`).

## Nest

```http
GET /api/v1/admin/tenants?q=
x-api-key: <ADMIN_API_KEY>
```

Each list row includes:

```json
{ "ordersPlacementLocked": true }
```

```http
GET /api/v1/admin/tenants/:tenantId/orders-lock
x-api-key: <ADMIN_API_KEY>
```

```json
{
  "tenantId": "uuid",
  "tenantName": "Gym",
  "subdomain": "gym",
  "locked": true,
  "lockedAt": "2026-10-01T07:00:00.000Z",
  "reason": "Non-payment"
}
```

`lockedAt` / `reason` are `null` when unlocked. `reason` is ops-only.

```http
PUT /api/v1/admin/tenants/:tenantId/orders-lock
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
| `GET /api/ops/tenants?env=` | List (includes `ordersPlacementLocked`) |
| `GET /api/ops/tenants/:id/orders-lock?env=` | GET …/orders-lock |
| `PUT /api/ops/tenants/:id/orders-lock?env=` | PUT …/orders-lock |

Proxy requires product Ops access. Keys never leave the server.

## UI

- Tenants list: narrow first column with a red lock icon when `ordersPlacementLocked` is true
- Tenant detail → Overview: **Lock Orders** / **Unlock Orders**
- Lock requires typing restaurant name + tenant id; optional reason
- After success, tenant list row is refreshed so the badge updates
