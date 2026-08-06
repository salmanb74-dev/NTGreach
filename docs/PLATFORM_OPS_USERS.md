# Platform Ops module (Reach users)

Cross-module **Ops** (not product Ops Resto/Alma). Sidebar: Home → Users list.

## Access

| Role | Meaning |
|---|---|
| `ops_admin` | Platform **Ops Admin** — can create/edit users + Nest Ops Resto/Alma when product is set |
| `ops_user` | Platform **Ops User** — view Users only |

Assign at least one of those roles on a profile to see the **Ops** module.

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

- Module home: `/platform` → `/platform/users`
- Detail: `/platform/users/[id]`
- CRM Settings → Users redirects here
