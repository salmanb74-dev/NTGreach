-- ============================================================
-- NTG Reach — Phase A Migrations
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Add roles to profiles (if not already done) ──────────
alter table public.profiles
  add column if not exists roles text[] default array['sales_rep'];

-- ─── 2. Enumerations table ────────────────────────────────────
-- Stores all admin-editable dropdown values
create table if not exists public.enumerations (
  id         uuid primary key default uuid_generate_v4(),
  category   text not null,  -- e.g. 'company_type', 'lead_source', 'city', 'currency'
  value      text not null,
  label      text not null,
  sort_order integer default 0,
  is_active  boolean default true,
  created_at timestamptz default now() not null,
  unique(category, value)
);

-- RLS
alter table public.enumerations enable row level security;
create policy "enumerations_select" on public.enumerations
  for select to authenticated using (true);
create policy "enumerations_admin_write" on public.enumerations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  );

-- ─── 3. Seed default enumerations ────────────────────────────
insert into public.enumerations (category, value, label, sort_order) values
  -- Company types (renamed from restaurant_type)
  ('company_type', 'fast_food_chain',    'Fast Food Chain',    1),
  ('company_type', 'fine_dining',        'Fine Dining',        2),
  ('company_type', 'casual_dining',      'Casual Dining',      3),
  ('company_type', 'cafe_coffee_shop',   'Café / Coffee Shop', 4),
  ('company_type', 'bakery',             'Bakery',             5),
  ('company_type', 'food_court',         'Food Court',         6),
  ('company_type', 'cloud_kitchen',      'Cloud Kitchen',      7),
  ('company_type', 'multi_branch_chain', 'Multi-branch Chain', 8),
  ('company_type', 'hotel_restaurant',   'Hotel Restaurant',   9),
  ('company_type', 'other',              'Other',              10),

  -- Lead sources
  ('lead_source', 'cold_call',  'Cold Call',  1),
  ('lead_source', 'cold_email', 'Cold Email', 2),
  ('lead_source', 'referral',   'Referral',   3),
  ('lead_source', 'linkedin',   'LinkedIn',   4),
  ('lead_source', 'website',    'Website',    5),
  ('lead_source', 'event',      'Event',      6),
  ('lead_source', 'import',     'Import',     7),
  ('lead_source', 'other',      'Other',      8),

  -- Cities
  ('city', 'karachi',         'Karachi',          1),
  ('city', 'lahore',          'Lahore',           2),
  ('city', 'faisalabad',      'Faisalabad',       3),
  ('city', 'rawalpindi',      'Rawalpindi',       4),
  ('city', 'gujranwala',      'Gujranwala',       5),
  ('city', 'peshawar',        'Peshawar',         6),
  ('city', 'multan',          'Multan',           7),
  ('city', 'hyderabad',       'Hyderabad',        8),
  ('city', 'islamabad',       'Islamabad',        9),
  ('city', 'quetta',          'Quetta',           10),
  ('city', 'bahawalpur',      'Bahawalpur',       11),
  ('city', 'sargodha',        'Sargodha',         12),
  ('city', 'sialkot',         'Sialkot',          13),
  ('city', 'sukkur',          'Sukkur',           14),
  ('city', 'larkana',         'Larkana',          15),
  ('city', 'sheikhupura',     'Sheikhupura',      16),
  ('city', 'rahim_yar_khan',  'Rahim Yar Khan',   17),
  ('city', 'jhang',           'Jhang',            18),
  ('city', 'okara',           'Okara',            19),
  ('city', 'gujrat',          'Gujrat',           20),

  -- Currencies
  ('currency', 'PKR', 'Pakistani Rupee (PKR)', 1),
  ('currency', 'USD', 'US Dollar (USD)',        2),
  ('currency', 'CAD', 'Canadian Dollar (CAD)',  3),
  ('currency', 'AED', 'UAE Dirham (AED)',       4),
  ('currency', 'SAR', 'Saudi Riyal (SAR)',      5)

on conflict (category, value) do nothing;

-- ─── 4. App settings table ────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;
create policy "app_settings_select" on public.app_settings
  for select to authenticated using (true);
create policy "app_settings_admin_write" on public.app_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and roles && array['admin']
    )
  );

-- Seed default settings
insert into public.app_settings (key, value) values
  ('input_currency', 'PKR'),
  ('view_currencies', 'PKR,USD,CAD')
on conflict (key) do nothing;
