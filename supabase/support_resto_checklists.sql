-- ============================================================
-- Support Resto: onboarding + training checklists (per restaurant)
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.
-- ============================================================

-- Master checklist items (editable templates)
create table if not exists public.support_checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  product     text not null default 'resto'
              check (product in ('resto', 'alma')),
  list_type   text not null check (list_type in ('onboarding', 'training')),
  label       text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists support_checklist_items_product_type_idx
  on public.support_checklist_items (product, list_type, sort_order)
  where is_active;

-- One saved checklist per restaurant (manual name)
create table if not exists public.support_checklist_restaurants (
  id          uuid primary key default uuid_generate_v4(),
  product     text not null default 'resto'
              check (product in ('resto', 'alma')),
  name        text not null,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists support_checklist_restaurants_product_name_idx
  on public.support_checklist_restaurants (product, lower(name));

create index if not exists support_checklist_restaurants_updated_idx
  on public.support_checklist_restaurants (product, updated_at desc);

-- Per-item status for a restaurant. No row = pending (still to do).
create table if not exists public.support_checklist_statuses (
  restaurant_id  uuid not null
                 references public.support_checklist_restaurants(id) on delete cascade,
  item_id        uuid not null
                 references public.support_checklist_items(id) on delete cascade,
  status         text not null check (status in ('done', 'not_required')),
  updated_by     uuid references auth.users(id),
  updated_at     timestamptz not null default now(),
  primary key (restaurant_id, item_id)
);

create index if not exists support_checklist_statuses_item_idx
  on public.support_checklist_statuses (item_id);

alter table public.support_checklist_items enable row level security;
alter table public.support_checklist_restaurants enable row level security;
alter table public.support_checklist_statuses enable row level security;

-- Template items: all CS agents can read; only CS admins can edit.
drop policy if exists "support_checklist_items_select" on public.support_checklist_items;
create policy "support_checklist_items_select" on public.support_checklist_items
  for select to authenticated
  using (public.is_cs_agent());

drop policy if exists "support_checklist_items_write" on public.support_checklist_items;
create policy "support_checklist_items_write" on public.support_checklist_items
  for all to authenticated
  using (public.is_cs_admin_user())
  with check (public.is_cs_admin_user());

-- Per-restaurant checklists + statuses: all CS agents.
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

drop trigger if exists support_checklist_items_updated_at on public.support_checklist_items;
create trigger support_checklist_items_updated_at
  before update on public.support_checklist_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists support_checklist_restaurants_updated_at on public.support_checklist_restaurants;
create trigger support_checklist_restaurants_updated_at
  before update on public.support_checklist_restaurants
  for each row execute procedure public.set_updated_at();

-- Seed default Resto items only when that product/type has none yet
do $$
declare
  onboarding_count integer;
  training_count   integer;
begin
  select count(*) into onboarding_count
  from public.support_checklist_items
  where product = 'resto' and list_type = 'onboarding';

  if onboarding_count = 0 then
    insert into public.support_checklist_items (product, list_type, label, sort_order) values
      ('resto', 'onboarding', 'Business / restaurant name', 10),
      ('resto', 'onboarding', 'Owner name', 20),
      ('resto', 'onboarding', 'Contact number', 30),
      ('resto', 'onboarding', 'Resto email address', 40),
      ('resto', 'onboarding', 'Employee names (waiters / riders)', 50),
      ('resto', 'onboarding', 'Site address', 60),
      ('resto', 'onboarding', 'Branch name (for receipt header)', 70),
      ('resto', 'onboarding', 'Menu added to Resto (photos optional)', 80),
      ('resto', 'onboarding', 'Number of tables and sections', 90),
      ('resto', 'onboarding', 'All employees added with roles', 100),
      ('resto', 'onboarding', 'Phone or email set for receipt printing', 110),
      ('resto', 'onboarding', 'NTN / SNTN on receipt (if required)', 120),
      ('resto', 'onboarding', 'Network and printer setup with test print (usually on site)', 130),
      ('resto', 'onboarding', 'Tax settings configured (15% cash / 8% card, exempt, or 15% on both)', 140),
      ('resto', 'onboarding', 'Service charges / delivery charges set', 150),
      ('resto', 'onboarding', 'Default ordering type set', 160),
      ('resto', 'onboarding', 'Owner account not shared with floor staff — use cashier, manager, waiter accounts', 170),
      ('resto', 'onboarding', 'PWA installed on owner / manager phone (if required)', 180),
      ('resto', 'onboarding', 'Date, timezone, and time verified on all order terminals', 190),
      ('resto', 'onboarding', 'KOT and bill print tested (line spacing and layout)', 200);
  end if;

  select count(*) into training_count
  from public.support_checklist_items
  where product = 'resto' and list_type = 'training';

  if training_count = 0 then
    insert into public.support_checklist_items (product, list_type, label, sort_order) values
      ('resto', 'training', 'Dashboard overview', 10),
      ('resto', 'training', 'New Order (open counter, order type, cart, punch, categories, immediate payment)', 20),
      ('resto', 'training', 'Orders (check bill, final bill, more)', 30),
      ('resto', 'training', 'Operations', 40),
      ('resto', 'training', 'Reports', 50),
      ('resto', 'training', 'Menu', 60),
      ('resto', 'training', 'Recipes', 70),
      ('resto', 'training', 'Inventory', 80),
      ('resto', 'training', 'Settings', 90);
  end if;
end $$;
