-- Platform Ops: password tracking, profile timestamps, ops_admin profile updates
-- Run in Supabase SQL Editor.

alter table public.profiles
  add column if not exists password_changed_at timestamptz;

alter table public.profiles
  add column if not exists updated_at timestamptz default now();

comment on column public.profiles.password_changed_at is
  'Last time password was set/changed via Ops Users (or known resets).';

comment on column public.profiles.updated_at is
  'Last profile modification (name, roles, products, password mark).';

-- Backfill missing updated_at for existing rows
update public.profiles
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- Keep updated_at fresh on every profile update
create or replace function public.set_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profiles_updated_at();

-- Ops Admins can update any profile (roles / products / name).
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

-- Ensure every authenticated user can list profiles (platform Ops Users page).
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Grant yourself platform Ops if needed:
-- update public.profiles
-- set roles = array(select distinct unnest(coalesce(roles,'{}'::text[]) || array['ops_admin']))
-- where email = 'YOUR_EMAIL@example.com';
