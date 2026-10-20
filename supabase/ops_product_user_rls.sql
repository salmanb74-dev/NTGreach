-- Ops product User role: allow ops_user to read product-ops data and
-- collect cash, while keeping settings / notes writes / release edits Admin-only.
-- Run in Supabase SQL Editor after deploying the Reach app changes.

-- ── Cash tenants: User can SELECT; Admin-only WRITE ─────────────
drop policy if exists "ops_cash_tenants_select" on public.ops_cash_tenants;
create policy "ops_cash_tenants_select" on public.ops_cash_tenants
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_cash_tenants_write" on public.ops_cash_tenants;
create policy "ops_cash_tenants_write" on public.ops_cash_tenants
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

-- ── Cash collections: User can SELECT + WRITE (collect + due sync) ─
-- App layer still blocks settings edits / expected-amount edits / deletes for User.
drop policy if exists "ops_cash_collections_select" on public.ops_cash_collections;
create policy "ops_cash_collections_select" on public.ops_cash_collections
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_cash_collections_write" on public.ops_cash_collections;
create policy "ops_cash_collections_write" on public.ops_cash_collections
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

-- ── Subscription notes: User SELECT; Admin WRITE ────────────────
drop policy if exists "ops_resto_subscription_notes_select" on public.ops_resto_subscription_notes;
create policy "ops_resto_subscription_notes_select" on public.ops_resto_subscription_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_resto_subscription_notes_write" on public.ops_resto_subscription_notes;
create policy "ops_resto_subscription_notes_write" on public.ops_resto_subscription_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_alma_subscription_notes_select" on public.ops_alma_subscription_notes;
create policy "ops_alma_subscription_notes_select" on public.ops_alma_subscription_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_alma_subscription_notes_write" on public.ops_alma_subscription_notes;
create policy "ops_alma_subscription_notes_write" on public.ops_alma_subscription_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

-- ── Release notes: User can read drafts; Admin manages ──────────
drop policy if exists "ops_release_notes_admin_select" on public.ops_release_notes;
create policy "ops_release_notes_admin_select" on public.ops_release_notes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );
