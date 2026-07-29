-- Phase F+: recurring shift series id
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

alter table public.support_shifts
  add column if not exists series_id uuid;

create index if not exists support_shifts_series_idx
  on public.support_shifts (series_id)
  where series_id is not null;
