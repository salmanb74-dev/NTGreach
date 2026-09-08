-- ============================================================
-- Ops Resto: cash collection tracking (Reach-side, production)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

-- Opt-in + schedule cache per Nest tenant (product = resto)
create table if not exists public.ops_cash_tenants (
  id                       uuid primary key default uuid_generate_v4(),
  tenant_id                text not null,
  product                  text not null default 'resto'
                           check (product in ('resto', 'alma')),
  enabled                  boolean not null default true,
  currency                 text not null default 'USD',
  -- Subscription start used as the billing anniversary anchor
  schedule_anchor          date,
  -- Billing cycle length in months (1, 3, 6, 12, …)
  cycle_months             integer not null default 1
                           check (cycle_months > 0),
  default_setup_amount     numeric(12,2),
  -- Amount charged each billing cycle (not necessarily "monthly")
  default_recurring_amount numeric(12,2),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (product, tenant_id)
);

create index if not exists ops_cash_tenants_enabled_idx
  on public.ops_cash_tenants (product, enabled)
  where enabled = true;

-- Collection history
create table if not exists public.ops_cash_collections (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     text not null,
  product       text not null default 'resto'
                check (product in ('resto', 'alma')),
  kind          text not null default 'recurring'
                check (kind in ('setup', 'recurring', 'other')),
  amount        numeric(12,2) not null check (amount >= 0),
  currency      text not null default 'USD',
  -- Scheduled charge date this row covers (anniversary on the cycle)
  due_date      date not null,
  -- When cash was actually received (may differ from due_date)
  collected_on  date not null default (current_date),
  notes         text,
  collected_by  uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ops_cash_collections_tenant_idx
  on public.ops_cash_collections (product, tenant_id, due_date desc);

create index if not exists ops_cash_collections_kind_idx
  on public.ops_cash_collections (product, tenant_id, kind);

alter table public.ops_cash_tenants enable row level security;
alter table public.ops_cash_collections enable row level security;

drop policy if exists "ops_cash_tenants_select" on public.ops_cash_tenants;
create policy "ops_cash_tenants_select" on public.ops_cash_tenants
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_cash_tenants_write" on public.ops_cash_tenants;
create policy "ops_cash_tenants_write" on public.ops_cash_tenants
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

drop policy if exists "ops_cash_collections_select" on public.ops_cash_collections;
create policy "ops_cash_collections_select" on public.ops_cash_collections
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_cash_collections_write" on public.ops_cash_collections;
create policy "ops_cash_collections_write" on public.ops_cash_collections
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

drop trigger if exists ops_cash_tenants_updated_at on public.ops_cash_tenants;
create trigger ops_cash_tenants_updated_at
  before update on public.ops_cash_tenants
  for each row execute procedure public.set_updated_at();

drop trigger if exists ops_cash_collections_updated_at on public.ops_cash_collections;
create trigger ops_cash_collections_updated_at
  before update on public.ops_cash_collections
  for each row execute procedure public.set_updated_at();
