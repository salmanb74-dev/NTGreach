# Platform Ops module (Reach users)

Cross-module **Ops** (not product Ops Resto/Alma). Sidebar: Home → Users list.

## Access model (UI)

### Roles

| Role | Meaning |
|---|---|
| **Sales Rep** | CRM work in selected CRM modules |
| **Support Rep** | Support work in selected Support modules |
| **Admin** | Elevated access; can manage users when **Ops** is selected; required for Ops Resto/Alma |
| **User** | Platform **Ops** view-only (Users list) |

Admin and User are exclusive.

### Modules

CRM Resto, CRM Alma, Support Resto, Support Alma, Ops Resto, Ops Alma, Ops.

Saving rules:

- CRM modules → Sales Rep or Admin
- Support modules → Support Rep or Admin
- Ops Resto / Ops Alma → Admin
- Ops → Admin or User

Storage: `profiles.roles` uses internal keys (`crm_sales_rep`, `ops_admin`, …).  
`profiles.products` stores **explicit module keys** for new/updated users (e.g. `crm_resto`, `ops`). Legacy `resto` / `alma` brand values still decode.

## Bootstrap Ops Admin

```sql
update public.profiles
set roles = (
  select array_agg(distinct r)
  from unnest(coalesce(roles, '{}'::text[]) || array['ops_admin']) as r
)
where email = 'YOUR_EMAIL@example.com';
```

## SQL migration

Run [`supabase/platform_ops_users.sql`](../supabase/platform_ops_users.sql):

- `profiles.password_changed_at`
- RLS so Ops Admins can update other profiles

## Env

`SUPABASE_SERVICE_ROLE_KEY` required to create users / reset passwords.

## Default temp password

New users and resets: `12345678`. Tracked via `password_changed_at` when set through Ops.

## Paths

- Module home: `/ops`
- Users: `/platform/users`
- Detail: `/platform/users/[id]`
- CRM Settings → Users redirects here
