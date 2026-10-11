-- ============================================================
-- Patch: open Resto checklist data to all CS agents
-- (template item edits remain CS admin only)
-- Run if you already applied support_resto_checklists.sql earlier.
-- Safe to re-run.
-- ============================================================

drop policy if exists "support_checklist_items_select" on public.support_checklist_items;
create policy "support_checklist_items_select" on public.support_checklist_items
  for select to authenticated
  using (public.is_cs_agent());

drop policy if exists "support_checklist_items_write" on public.support_checklist_items;
create policy "support_checklist_items_write" on public.support_checklist_items
  for all to authenticated
  using (public.is_cs_admin_user())
  with check (public.is_cs_admin_user());

drop policy if exists "support_checklist_restaurants_select" on public.support_checklist_restaurants;
create policy "support_checklist_restaurants_select" on public.support_checklist_restaurants
  for select to authenticated
  using (public.is_cs_agent());

drop policy if exists "support_checklist_restaurants_write" on public.support_checklist_restaurants;
create policy "support_checklist_restaurants_write" on public.support_checklist_restaurants
  for all to authenticated
  using (public.is_cs_agent())
  with check (public.is_cs_agent());

drop policy if exists "support_checklist_statuses_select" on public.support_checklist_statuses;
create policy "support_checklist_statuses_select" on public.support_checklist_statuses
  for select to authenticated
  using (public.is_cs_agent());

drop policy if exists "support_checklist_statuses_write" on public.support_checklist_statuses;
create policy "support_checklist_statuses_write" on public.support_checklist_statuses
  for all to authenticated
  using (public.is_cs_agent())
  with check (public.is_cs_agent());
