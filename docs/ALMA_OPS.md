# Alma Ops portal (Reach → Nest)

Internal ops UI at `/ops_alma` for users with the `ops_admin` role and the
`alma` / `ops_alma` product on their profile (**Ops Alma**).

Completely independent from Ops Resto: separate Nest base URL + API key,
separate Reach proxies under `/api/ops/alma/*`, separate subscription notes table.

## What v1 does

- Module switcher: **Ops Alma**
- Sidebar: **Home**, **Tenants** (`/ops_alma/management`)
- **Tenants:** Staging/Production toggle (default **production** until Alma staging exists); searchable list; tenant detail tabs
- Tenant **Overview**: indefinite **assessments-creation lock** (Lock / Unlock Assessments)
- Tenant **Subscription**: Enterprise offer (limits + paid add-ons)
- Tenant **Cash** / **Delete** / **Logs**: same patterns as Ops Resto (Alma Nest / Reach cash with `product=alma`)
- Contracts: [`ALMA_ADMIN_SUBSCRIPTION_CONTRACT.md`](./ALMA_ADMIN_SUBSCRIPTION_CONTRACT.md), [`ALMA_ADMIN_ASSESSMENTS_LOCK_CONTRACT.md`](./ALMA_ADMIN_ASSESSMENTS_LOCK_CONTRACT.md), Nest build prompt [`ALMA_NEST_ADMIN_PROMPT.md`](./ALMA_NEST_ADMIN_PROMPT.md)

Reach never talks to Alma Supabase for this. The browser never sees Alma API keys.

## Required Reach env (server-only)

```env
# Staging (optional until ready)
ALMA_STAGING_BASE_URL=https://alma-staging.example.com
ALMA_STAGING_ADMIN_API_KEY=...

# Production
ALMA_PROD_BASE_URL=https://alma.ntgapps.com
ALMA_PROD_ADMIN_API_KEY=...
```

Also add these on Netlify for production deploys. Do **not** prefix with `NEXT_PUBLIC_`.

When Alma staging env vars are missing, Staging returns HTTP 503. Production
defaults when `env` is omitted on Alma routes.

## Reach proxies

| Reach | Nest |
|---|---|
| `GET /api/ops/alma/tenants?env=staging\|production` | `GET /api/v1/admin/tenants` |
| `GET /api/ops/alma/tenants/:id/subscription?env=…` | `GET /api/v1/admin/tenants/:id/subscription` |
| `PUT /api/ops/alma/tenants/:id/subscription/enterprise?env=…` | `PUT /api/v1/admin/tenants/:id/subscription/enterprise` |
| `DELETE /api/ops/alma/tenants/:id/subscription/enterprise?env=&force=` | `DELETE /api/v1/admin/tenants/:id/subscription/enterprise` |
| `GET /api/ops/alma/tenants/:id/assessments-lock?env=…` | `GET /api/v1/admin/tenants/:id/assessments-lock` |
| `PUT /api/ops/alma/tenants/:id/assessments-lock?env=…` | `PUT /api/v1/admin/tenants/:id/assessments-lock` |
| `DELETE /api/ops/alma/tenants/:id?env=…` body `{ confirmTenantId }` | `DELETE /api/v1/admin/tenants/:tenantId` |
| `GET /api/ops/alma/logs?env=…&…` | `GET /api/v1/admin/logs` (`api_hits`) |

Those routes require `ops_admin` **and** Ops Alma product access. They never share
Resto Nest credentials.

## Catalog defaults (Reach mirror)

| Plan | Branches | Students | Storage (GB) |
|---|---|---|---|
| Free / Starter | 1 | 200 | 10 |
| Pro | 3 | 500 | 25 |
| Enterprise | unlimited (offer-driven) | unlimited | unlimited |

Starter/Pro list prices currently mirror Resto ($35 / $70 + setup) until Alma
commerce is finalized.

## Paid feature add-ons (booleans + $/mo)

Fees · Library · Behavioural · Uniform Inventory · White label · Google Classroom

## Access

1. Assign `ops_admin` and product `alma` or module `ops_alma` (see SQL below).
2. Switch module to **Ops Alma**.
3. Open **Tenants** (`/ops_alma/management`).

## SQL — grant Ops Alma

```sql
-- Ensure ops_admin + alma brand (legacy products format)
update public.profiles
set
  roles = (
    select coalesce(array_agg(distinct r), '{}'::text[])
    from unnest(coalesce(roles, '{}'::text[]) || array['ops_admin']) as r
  ),
  products = (
    select array_agg(distinct p)
    from unnest(coalesce(products, '{}'::text[]) || array['alma']) as p
  )
where email = 'YOUR_EMAIL@example.com';

-- Or, if products already store module keys:
-- update public.profiles
-- set products = (
--   select array_agg(distinct p)
--   from unnest(coalesce(products, '{}'::text[]) || array['ops_alma']) as p
-- )
-- where email = 'YOUR_EMAIL@example.com';

select id, email, roles, products
from public.profiles
where email = 'YOUR_EMAIL@example.com';
```

Also run `supabase/ops_alma_subscription_notes.sql` once for Reach-only offer notes.

After running, refresh Reach (or clear the `ntg-active-module` cookie if needed).
