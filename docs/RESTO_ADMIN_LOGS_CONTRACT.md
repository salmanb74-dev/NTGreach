# Resto Admin Logs API — Reach integration (api_hits)

Nest returns **HTTP traffic** from Supabase `api_hits` (≈24h retention), not `audit_logs`.

## Nest

```http
GET /api/v1/admin/logs
x-api-key: <ADMIN_API_KEY>
```

| Query | Notes |
|---|---|
| `tenantId` | optional |
| `method` | optional HTTP method |
| `statusCode` | optional |
| `actionType` | method **or** URL substring (e.g. `orders`) |
| `from` / `to` | ISO-8601 on `created_at` |
| `limit` | default 50, max 200 |
| `cursor` | from previous `nextCursor` |

**200:**

```json
{
  "data": [
    {
      "id": "...",
      "tenantId": "...",
      "tenantName": "Sunshine Cafe",
      "branchId": null,
      "userId": "...",
      "userName": "...",
      "userEmail": "...",
      "actionType": "GET /api/v1/orders",
      "metadata": {
        "method": "GET",
        "url": "/api/v1/orders",
        "statusCode": 200,
        "responseTimeMs": 42,
        "requestBody": null,
        "responseBody": null
      },
      "createdAt": "..."
    }
  ],
  "nextCursor": null
}
```

Empty `data` often means no recent traffic (retention ~24h), not a Reach bug.

## Reach

| Reach | Nest |
|---|---|
| `GET /api/ops/logs?env=&tenantId=&method=&statusCode=&actionType=&cursor=&limit=` | `GET /api/v1/admin/logs` |

UI:

- Tenant detail → **Logs** tab (tenant filter locked)
- Optional full page: `/ops/logs` (all tenants for env)

Proxy requires product Ops access (`ops_admin` + product).
