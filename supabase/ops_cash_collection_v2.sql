-- ============================================================
-- Ops cash collection v2: expected due rows + partial payments
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- Prerequisite: ops_cash_collection.sql
-- ============================================================

-- Separate pre-trial setup default (enterprise setup stays on default_setup_amount)
alter table public.ops_cash_tenants
  add column if not exists default_pre_trial_setup_amount numeric(12,2);

-- Expected amount per due row (collected amount stays in `amount` until rename)
alter table public.ops_cash_collections
  add column if not exists expected_amount numeric(12,2);

alter table public.ops_cash_collections
  add column if not exists status text;

-- Rename collected amount column when still named `amount`
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ops_cash_collections'
      and column_name = 'amount'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ops_cash_collections'
      and column_name = 'amount_collected'
  ) then
    alter table public.ops_cash_collections rename column amount to amount_collected;
  end if;
end $$;

-- Backfill expected + status from legacy payment history
update public.ops_cash_collections
set expected_amount = coalesce(expected_amount, amount_collected, 0)
where expected_amount is null;

update public.ops_cash_collections
set status = case
  when coalesce(amount_collected, 0) <= 0 then 'due'
  when coalesce(amount_collected, 0) < coalesce(expected_amount, 0) then 'partial'
  else 'collected'
end
where status is null
   or status not in ('due', 'partial', 'collected');

-- Existing history rows were full payments — treat as collected
update public.ops_cash_collections
set status = 'collected'
where coalesce(amount_collected, 0) > 0
  and status = 'due'
  and coalesce(expected_amount, 0) <= coalesce(amount_collected, 0);

alter table public.ops_cash_collections
  alter column expected_amount set default 0;

alter table public.ops_cash_collections
  alter column expected_amount set not null;

alter table public.ops_cash_collections
  alter column amount_collected set default 0;

alter table public.ops_cash_collections
  alter column status set default 'due';

alter table public.ops_cash_collections
  alter column status set not null;

-- Uncollected expected rows have no collection date
alter table public.ops_cash_collections
  alter column collected_on drop not null;

-- Widen kind check for pre-trial setup
alter table public.ops_cash_collections
  drop constraint if exists ops_cash_collections_kind_check;

alter table public.ops_cash_collections
  add constraint ops_cash_collections_kind_check
  check (kind in ('setup', 'setup_pre_trial', 'recurring', 'other'));

alter table public.ops_cash_collections
  drop constraint if exists ops_cash_collections_status_check;

alter table public.ops_cash_collections
  add constraint ops_cash_collections_status_check
  check (status in ('due', 'partial', 'collected'));

-- Merge duplicate legacy receipts for the same due key before unique index
with ranked as (
  select
    id,
    product,
    tenant_id,
    kind,
    due_date,
    amount_collected,
    expected_amount,
    collected_on,
    notes,
    collected_by,
    created_at,
    row_number() over (
      partition by product, tenant_id, kind, due_date
      order by collected_on desc nulls last, created_at desc
    ) as rn,
    sum(amount_collected) over (
      partition by product, tenant_id, kind, due_date
    ) as total_collected,
    max(expected_amount) over (
      partition by product, tenant_id, kind, due_date
    ) as max_expected
  from public.ops_cash_collections
),
keepers as (
  update public.ops_cash_collections c
  set
    amount_collected = r.total_collected,
    expected_amount = greatest(r.max_expected, r.total_collected),
    status = case
      when r.total_collected <= 0 then 'due'
      when r.total_collected < greatest(r.max_expected, r.total_collected) then 'partial'
      else 'collected'
    end,
    collected_on = case
      when r.total_collected > 0 then coalesce(c.collected_on, current_date)
      else null
    end
  from ranked r
  where c.id = r.id
    and r.rn = 1
  returning c.id
)
delete from public.ops_cash_collections c
using ranked r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists ops_cash_collections_due_uniq
  on public.ops_cash_collections (product, tenant_id, kind, due_date);

create index if not exists ops_cash_collections_status_idx
  on public.ops_cash_collections (product, tenant_id, status, due_date);
