-- Phase F+: scope support_shifts by product (resto | alma), like chats / visits.
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- Existing rows default to 'resto' (prior shared roster).

alter table public.support_shifts
  add column if not exists product text;

update public.support_shifts
set product = 'resto'
where product is null;

alter table public.support_shifts
  alter column product set default 'resto';

alter table public.support_shifts
  alter column product set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_shifts_product_check'
  ) then
    alter table public.support_shifts
      add constraint support_shifts_product_check
      check (product in ('resto', 'alma'));
  end if;
end $$;

create index if not exists support_shifts_product_start_idx
  on public.support_shifts (product, start_at);
