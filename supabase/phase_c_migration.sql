-- ============================================================
-- NTG Reach — Phase C Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.targets (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null,         -- e.g. "Q1 2025", "Jan 2025"
  start_date       date not null,
  end_date         date not null,
  leads_target     integer,
  setup_fee_target numeric(12,2),
  mrr_target       numeric(12,2),
  revenue_target   numeric(12,2),
  created_at       timestamptz default now() not null
);

alter table public.targets enable row level security;

-- Managers/admins can read all targets, sales reps only their own
create policy "targets_select" on public.targets
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['manager','admin']
    )
  );

-- Managers/admins can write all targets
create policy "targets_write" on public.targets
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['manager','admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['manager','admin']
    )
  );
