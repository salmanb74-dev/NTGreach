-- ============================================================
-- Platform Ops: Docs + Ops Lists & Values (isolated from CRM)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

-- ─── 1. ops_enumerations (Doc categories / subcategories) ─────
create table if not exists public.ops_enumerations (
  id         uuid primary key default uuid_generate_v4(),
  category   text not null,  -- 'doc_category' | 'doc_subcategory'
  value      text not null,
  label      text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, value)
);

create index if not exists ops_enumerations_category_idx
  on public.ops_enumerations (category, sort_order);

alter table public.ops_enumerations enable row level security;

drop policy if exists "ops_enumerations_select" on public.ops_enumerations;
create policy "ops_enumerations_select" on public.ops_enumerations
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_enumerations_admin_write" on public.ops_enumerations;
create policy "ops_enumerations_admin_write" on public.ops_enumerations
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

insert into public.ops_enumerations (category, value, label, sort_order) values
  ('doc_category', 'alma',  'Alma',  1),
  ('doc_category', 'resto', 'Resto', 2),
  ('doc_category', 'admin', 'Admin', 3),
  ('doc_category', 'other', 'Other', 4),
  ('doc_subcategory', 'engineering',        'Engineering',         1),
  ('doc_subcategory', 'sales_marketing',    'Sales & Marketing',   2),
  ('doc_subcategory', 'general',            'General',             3)
on conflict (category, value) do nothing;

-- ─── 2. ops_docs (OneDrive folder / file links) ───────────────
create table if not exists public.ops_docs (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  url              text not null,
  kind             text not null check (kind in ('folder', 'file')),
  category_value   text not null,
  subcategory_value text not null,
  description      text,
  sort_order       integer not null default 0,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ops_docs_category_idx
  on public.ops_docs (category_value, subcategory_value, sort_order);
create index if not exists ops_docs_created_by_idx
  on public.ops_docs (created_by);

alter table public.ops_docs enable row level security;

drop policy if exists "ops_docs_select" on public.ops_docs;
create policy "ops_docs_select" on public.ops_docs
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
  );

drop policy if exists "ops_docs_insert" on public.ops_docs;
create policy "ops_docs_insert" on public.ops_docs
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and coalesce(roles, '{}'::text[]) && array['ops_admin', 'ops_user']
    )
    and created_by = auth.uid()
  );

-- Ops User: update/delete own rows. Ops Admin: any row.
drop policy if exists "ops_docs_update" on public.ops_docs;
create policy "ops_docs_update" on public.ops_docs
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (
          coalesce(roles, '{}'::text[]) && array['ops_admin']
          or (
            coalesce(roles, '{}'::text[]) && array['ops_user']
            and created_by = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (
          coalesce(roles, '{}'::text[]) && array['ops_admin']
          or (
            coalesce(roles, '{}'::text[]) && array['ops_user']
            and created_by = auth.uid()
          )
        )
    )
  );

drop policy if exists "ops_docs_delete" on public.ops_docs;
create policy "ops_docs_delete" on public.ops_docs
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (
          coalesce(roles, '{}'::text[]) && array['ops_admin']
          or (
            coalesce(roles, '{}'::text[]) && array['ops_user']
            and created_by = auth.uid()
          )
        )
    )
  );

create or replace function public.set_ops_docs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ops_docs_updated_at on public.ops_docs;
create trigger ops_docs_updated_at
  before update on public.ops_docs
  for each row execute procedure public.set_ops_docs_updated_at();
