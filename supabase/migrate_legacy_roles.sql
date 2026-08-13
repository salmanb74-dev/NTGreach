-- ============================================================
-- Migrate away from legacy roles: admin, manager, sales_rep
-- → crm_admin, crm_manager, crm_sales_rep (+ keep cs_*/ops_*)
-- ============================================================

-- 1) Profile data: rewrite legacy role tokens
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
where roles is null
   or roles = '{}'
   or roles && array['admin','manager','sales_rep'];

-- Ensure nobody is left with an empty roles array
update public.profiles
set roles = array['crm_sales_rep']
where roles is null or roles = '{}';

-- 2) Default for new profiles
alter table public.profiles
  alter column roles set default array['crm_sales_rep']::text[];

-- 3) RLS policies — CRM admin/manager only (no legacy names)

-- Enumerations
drop policy if exists "enumerations_admin_write" on public.enumerations;
create policy "enumerations_admin_write" on public.enumerations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  );

-- App settings
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  );

-- Targets
drop policy if exists "targets_select" on public.targets;
create policy "targets_select" on public.targets
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  );

drop policy if exists "targets_write" on public.targets;
create policy "targets_write" on public.targets
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  );

-- Exchange rates
drop policy if exists "exchange_rates_write" on public.exchange_rates;
create policy "exchange_rates_write" on public.exchange_rates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['crm_admin']
    )
  );

-- Exchange rate history (phase_d2) if present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'exchange_rate_history'
  ) then
    execute 'drop policy if exists "exchange_rate_history_write" on public.exchange_rate_history';
    execute $p$
      create policy "exchange_rate_history_write" on public.exchange_rate_history
        for all to authenticated
        using (
          exists (
            select 1 from public.profiles
            where id = auth.uid() and roles && array['crm_admin']
          )
        )
        with check (
          exists (
            select 1 from public.profiles
            where id = auth.uid() and roles && array['crm_admin']
          )
        )
    $p$;
  end if;
end $$;

-- Contract templates
drop policy if exists "contract_templates_write" on public.contract_templates;
create policy "contract_templates_write" on public.contract_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  );

-- Quotation templates
drop policy if exists "quotation_templates_write" on public.quotation_templates;
create policy "quotation_templates_write" on public.quotation_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and roles && array['crm_admin','crm_manager']
    )
  );
