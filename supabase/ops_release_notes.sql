-- ============================================================
-- Ops: public release notes (Resto + Alma)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

create table if not exists public.ops_release_notes (
  id            uuid primary key default uuid_generate_v4(),
  product       text not null check (product in ('resto', 'alma')),
  title         text not null,
  version       text,
  body_html     text not null default '',
  is_published  boolean not null default false,
  published_at  timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ops_release_notes_product_published_idx
  on public.ops_release_notes (product, is_published, published_at desc nulls last);

create index if not exists ops_release_notes_product_updated_idx
  on public.ops_release_notes (product, updated_at desc);

alter table public.ops_release_notes enable row level security;

-- Public + authenticated can read published notes
drop policy if exists "ops_release_notes_public_select" on public.ops_release_notes;
create policy "ops_release_notes_public_select" on public.ops_release_notes
  for select
  to anon, authenticated
  using (is_published = true);

-- Ops admins can read drafts and manage all notes
drop policy if exists "ops_release_notes_admin_select" on public.ops_release_notes;
create policy "ops_release_notes_admin_select" on public.ops_release_notes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_release_notes_admin_insert" on public.ops_release_notes;
create policy "ops_release_notes_admin_insert" on public.ops_release_notes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop policy if exists "ops_release_notes_admin_update" on public.ops_release_notes;
create policy "ops_release_notes_admin_update" on public.ops_release_notes
  for update
  to authenticated
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

drop policy if exists "ops_release_notes_admin_delete" on public.ops_release_notes;
create policy "ops_release_notes_admin_delete" on public.ops_release_notes
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin']
    )
  );

drop trigger if exists ops_release_notes_updated_at on public.ops_release_notes;
create trigger ops_release_notes_updated_at
  before update on public.ops_release_notes
  for each row execute procedure public.set_updated_at();
