-- Platform Ops: password tracking + ops_admin may update other profiles
-- Run in Supabase SQL Editor.

alter table public.profiles
  add column if not exists password_changed_at timestamptz;

comment on column public.profiles.password_changed_at is
  'Last time password was set/changed via Ops Users (or known resets).';

-- Existing profiles: leave null (UI shows —) until next known password set.

-- Ops Admins can update any profile (roles / products / name).
-- "Using" checks the caller's roles; "with check" allows the new row.

drop policy if exists "profiles_ops_admin_update" on public.profiles;
create policy "profiles_ops_admin_update"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.roles, '{}'::text[]) && array['ops_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.roles, '{}'::text[]) && array['ops_admin']
    )
  );

-- Ops Admin/User can select all profiles (may already be public select).
-- Keep broad select if present; add explicit policy only if select is restricted.

-- Grant yourself platform Ops if needed:
-- update public.profiles
-- set roles = array(select distinct unnest(coalesce(roles,'{}'::text[]) || array['ops_admin']))
-- where email = 'YOUR_EMAIL@example.com';
