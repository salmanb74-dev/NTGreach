-- ============================================================
-- NTG Reach — Phase D2 Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Historical exchange rates table ──────────────────────
create table if not exists public.exchange_rate_history (
  id         uuid primary key default uuid_generate_v4(),
  base       text not null,
  target     text not null,
  rate       numeric(16,6) not null,
  rate_date  date not null,
  fetched_at timestamptz default now() not null,
  unique(base, target, rate_date)
);

alter table public.exchange_rate_history enable row level security;

create policy "exchange_rate_history_select" on public.exchange_rate_history
  for select to authenticated using (true);

create policy "exchange_rate_history_write" on public.exchange_rate_history
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  );

-- Also allow service role to insert (for scheduled function)
create policy "exchange_rate_history_service" on public.exchange_rate_history
  for all to service_role using (true) with check (true);

-- ─── 2. Add currency column to targets ───────────────────────
alter table public.targets
  add column if not exists currency text default 'PKR';

-- Backfill existing targets with current input currency
update public.targets
set currency = (
  select value from public.app_settings where key = 'input_currency'
)
where currency is null;

-- ─── 3. Also allow service role on exchange_rates ────────────
create policy "exchange_rates_service" on public.exchange_rates
  for all to service_role using (true) with check (true);
