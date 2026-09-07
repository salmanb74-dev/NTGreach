-- ============================================================
-- Fix targets RLS + ensure currency column
-- Run in: Supabase Dashboard → SQL Editor
-- Fixes: new row violates row-level security policy for table "targets"
-- ============================================================

-- Currency column (idempotent)
alter table public.targets
  add column if not exists currency text default 'PKR';

update public.targets
set currency = coalesce(
  (select value from public.app_settings where key = 'input_currency'),
  'PKR'
)
where currency is null or currency = '';

-- Rewrite any leftover legacy role tokens on profiles
update public.profiles
set roles = (
  select coalesce(array_agg(distinct new_role), array['crm_sales_rep']::text[])
  from (
    select case r
      when 'admin'     then 'crm_admin'
      when 'manager'   then 'crm_manager'
      when 'sales_rep' then 'crm_sales_rep'
      else r
    end as new_role
    from unnest(coalesce(roles, array[]::text[])) as r
  ) mapped
)
where roles && array['admin','manager','sales_rep'];

-- Recreate policies (drop all known variants first)
drop policy if exists "targets_select" on public.targets;
drop policy if exists "targets_write" on public.targets;
drop policy if exists "targets_insert" on public.targets;
drop policy if exists "targets_update" on public.targets;
drop policy if exists "targets_delete" on public.targets;

create policy "targets_select" on public.targets
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.roles && array['crm_admin','crm_manager','admin','manager']
    )
  );

create policy "targets_write" on public.targets
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.roles && array['crm_admin','crm_manager','admin','manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.roles && array['crm_admin','crm_manager','admin','manager']
    )
  );

notify pgrst, 'reload schema';

-- Sanity check: your roles must include crm_admin or crm_manager
-- select id, email, roles from public.profiles where id = auth.uid();
