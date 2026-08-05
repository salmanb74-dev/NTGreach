# Resto Ops portal (Reach → Nest)

Internal ops UI at `/ops` for users with the `ops_admin` role (and the matching
product on their profile, e.g. `resto` → **Ops Resto**).

## What v1 does

- Sidebar: **Home** (blank), **Management**, **Reports**, **Logs**, **Subscription**
- **Management:** toggle Staging vs Production; list tenants (name, owner, email, id); search; tenant detail shell
- Reports / Logs / Subscription: blank placeholders for now
  - Logs UI blocked on Nest — see [`RESTO_ADMIN_LOGS_CONTRACT.md`](./RESTO_ADMIN_LOGS_CONTRACT.md)

Reach never talks to Resto Supabase for this. The browser never sees Resto API keys.

## Required Reach env (server-only)

```env
RESTO_STAGING_BASE_URL=https://resto-staging.example.com
RESTO_STAGING_ADMIN_API_KEY=...

RESTO_PROD_BASE_URL=https://resto.example.com
RESTO_PROD_ADMIN_API_KEY=...
```

Also add these on Netlify for production deploys. Do **not** prefix with `NEXT_PUBLIC_`.

## Expected Resto Nest endpoint

```http
GET {base}/api/v1/admin/tenants
x-api-key: <RESTO_*_ADMIN_API_KEY>
```

Response (Nest shape; bare array / `{ "tenants": [...] }` also accepted):

```json
{
  "data": [
    {
      "id": "uuid-or-slug",
      "name": "Clay Handi",
      "ownerName": "Salman Bakhtiyar",
      "ownerEmail": "salman@example.com"
    }
  ]
}
```

`owner_name` / `owner_email` snake_case is also accepted.

## Reach proxy

Authenticated Reach ops users call:

`GET /api/ops/tenants?env=staging|production`

That route checks the Reach session (`ops_*` role), then calls Nest with the matching env key.

If env vars are missing, the UI shows **Resto admin API not configured** (HTTP 503).

## Access

1. Assign the user role `ops_admin` and product `resto` (see SQL below).
2. Switch module to **Ops Resto** in the top-right module selector.
3. Open **Management** in the sidebar (`/ops/management`) for the tenant list.

## SQL — migrate roles to Ops

```sql
-- Replace legacy admin_resto / admin_alma with ops_admin (keeps other roles)
update public.profiles
set roles = (
  select coalesce(array_agg(distinct r), '{}'::text[])
  from (
    select unnest(
      array_remove(array_remove(coalesce(roles, '{}'::text[]), 'admin_resto'), 'admin_alma')
      || array['ops_admin']
    ) as r
  ) s
)
where roles && array['admin_resto', 'admin_alma']
   or email = 'YOUR_EMAIL@example.com';

-- Ensure resto product is present for Ops Resto module
update public.profiles
set products = (
  select array_agg(distinct p)
  from unnest(coalesce(products, '{}'::text[]) || array['resto']) as p
)
where email = 'YOUR_EMAIL@example.com';

select id, email, roles, products
from public.profiles
where email = 'YOUR_EMAIL@example.com';
```

After running, refresh Reach (or clear the `ntg-active-module` cookie if it still says `admin_resto`).
