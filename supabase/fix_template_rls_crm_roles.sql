-- Contract/quotation template write policies — crm_admin / crm_manager only.
-- Prefer supabase/migrate_legacy_roles.sql for a full live DB cutover.

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
