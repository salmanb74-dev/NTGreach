-- Phase F: Support roster — admin-only shift mutations + offline message setting
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

-- Only cs_admin may create / edit / delete shifts (all agents may still SELECT)
drop policy if exists "support_shifts_insert" on public.support_shifts;
create policy "support_shifts_insert" on public.support_shifts
  for insert to authenticated
  with check (public.is_cs_admin_user());

drop policy if exists "support_shifts_update" on public.support_shifts;
create policy "support_shifts_update" on public.support_shifts
  for update to authenticated
  using (public.is_cs_admin_user())
  with check (public.is_cs_admin_user());

drop policy if exists "support_shifts_delete" on public.support_shifts;
create policy "support_shifts_delete" on public.support_shifts
  for delete to authenticated
  using (public.is_cs_admin_user());

-- Offline hours message for customers when no one is on duty
insert into public.app_settings (key, value)
values (
  'support_offline_message',
  'Our support team is currently offline. We will get back to you as soon as possible.'
)
on conflict (key) do nothing;
