# Resto Admin Delete Tenant — Reach integration

Nest hard-deletes a tenant and related data (shared with CLI
`script:delete-tenant-data`). Documented on Nest as `ADMIN_REACH.md`.

## Nest

```http
DELETE /api/v1/admin/tenants/:tenantId
x-api-key: <ADMIN_API_KEY>
Content-Type: application/json

{ "confirmTenantId": "<same UUID as path>" }
```

Optional: `"confirm": true` (Nest rejects only when `confirm === false`).

**200:** `{ deleted, tenantId, tenantName, summary }`  
`summary` may include counts (`usersDeleted`, `ordersDeleted`, `apiHitsDeleted`, …) and `warnings[]`.

| Status | When |
|---|---|
| 400 | Bad UUID / missing or mismatched `confirmTenantId` |
| 401 | Bad API key |
| 404 | Tenant not found |
| 500 | Failed mid-delete (may leave partial cleanup) |
| 503 | Nest `ADMIN_API_KEY` not set |

### Cleanup coverage (Nest core, high level)

Users + Auth · branches · orders · menu/inventory · customers · taxes · POS · custom payment methods · demo seed · **api_hits** · **audit_logs** · translations (no FK) · subscriptions/invoices · tenant row.

Gaps called out vs older CLI (now fixed in Nest core): translation orphans, api_hits SET NULL, audit_logs, newer tables, multi-subscription delete.

## Reach

| Reach | Nest |
|---|---|
| `DELETE /api/ops/tenants/:id?env=staging\|production` | `DELETE /api/v1/admin/tenants/:id` |

Proxy requires product Ops access (`ops_admin` + resto product). Keys never leave the server.

UI: tenant detail → **Delete** tab — confirm restaurant name + tenant id + acknowledgment before call.
