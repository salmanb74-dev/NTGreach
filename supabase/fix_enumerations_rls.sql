-- Fix enumerations write RLS for CRM roles (incl. legacy admin/manager tokens).
-- Run in Supabase SQL Editor if Lists & Values saves silently fail.

drop policy if exists "enumerations_admin_write" on public.enumerations;
create policy "enumerations_admin_write" on public.enumerations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['crm_admin','crm_manager','admin','manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['crm_admin','crm_manager','admin','manager']
    )
  );
