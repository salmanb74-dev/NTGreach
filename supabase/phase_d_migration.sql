-- ============================================================
-- NTG Reach — Phase D Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.exchange_rates (
  id           uuid primary key default uuid_generate_v4(),
  base         text not null,
  target       text not null,
  rate         numeric(16,6) not null,
  fetched_at   timestamptz default now() not null,
  unique(base, target)
);

alter table public.exchange_rates enable row level security;

create policy "exchange_rates_select" on public.exchange_rates
  for select to authenticated using (true);

create policy "exchange_rates_write" on public.exchange_rates
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
