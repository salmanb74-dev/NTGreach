-- Support on-site visit logging (replaces support_time_logs clock-in/out).

create table if not exists public.support_site_visits (
  id                uuid primary key default uuid_generate_v4(),
  agent_id          uuid not null references auth.users(id),
  product           text not null default 'resto'
                    check (product in ('resto', 'alma')),
  visit_date        date not null,
  visit_time        time not null,
  duration_minutes  integer not null
                    check (duration_minutes > 0 and duration_minutes % 15 = 0),
  tenant_id         text,
  customer_name     text not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists support_site_visits_agent_date_idx
  on public.support_site_visits (agent_id, visit_date desc, visit_time desc);

create index if not exists support_site_visits_product_date_idx
  on public.support_site_visits (product, visit_date desc);

alter table public.support_site_visits enable row level security;

create policy "support_site_visits_select" on public.support_site_visits
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_site_visits_insert" on public.support_site_visits
  for insert to authenticated
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

create policy "support_site_visits_update" on public.support_site_visits
  for update to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  )
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

create policy "support_site_visits_delete" on public.support_site_visits
  for delete to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

-- Remove clock-in/out time logging.
drop policy if exists "support_time_logs_select" on public.support_time_logs;
drop policy if exists "support_time_logs_insert" on public.support_time_logs;
drop policy if exists "support_time_logs_update" on public.support_time_logs;
drop policy if exists "support_time_logs_delete" on public.support_time_logs;
drop index if exists public.support_time_logs_one_open_per_agent;
drop index if exists public.support_time_logs_agent_idx;
drop table if exists public.support_time_logs;
