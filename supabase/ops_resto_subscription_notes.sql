-- ============================================================
-- Ops Resto: internal subscription offer notes (Reach-only)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

create table if not exists public.ops_resto_subscription_notes (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    text not null,
  env          text not null check (env in ('staging', 'production')),
  offer_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, env)
);

create index if not exists ops_resto_subscription_notes_tenant_idx
  on public.ops_resto_subscription_notes (tenant_id, env);

alter table public.ops_resto_subscription_notes enable row level security;

drop policy if exists "ops_resto_subscription_notes_select" on public.ops_resto_subscription_notes;
create policy "ops_resto_subscription_notes_select" on public.ops_resto_subscription_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_resto_subscription_notes_write" on public.ops_resto_subscription_notes;
create policy "ops_resto_subscription_notes_write" on public.ops_resto_subscription_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop trigger if exists ops_resto_subscription_notes_updated_at on public.ops_resto_subscription_notes;
create trigger ops_resto_subscription_notes_updated_at
  before update on public.ops_resto_subscription_notes
  for each row execute procedure public.set_updated_at();
