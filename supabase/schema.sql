-- ============================================================
-- NTG Reach — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────
-- Extends Supabase auth.users with display name + MS token
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  email            text not null,
  ms_access_token  text,
  ms_token_expiry  timestamptz,
  created_at       timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Leads ────────────────────────────────────────────────────
create table if not exists public.leads (
  id               uuid primary key default uuid_generate_v4(),
  company_name     text not null,
  contact_name     text not null,
  email            text,
  phone            text,
  city             text,
  restaurant_type  text,
  source           text,
  stage            text not null default 'new'
                   check (stage in (
                     'new','contacted','demo_scheduled',
                     'proposal_sent','negotiation','closed_won','closed_lost'
                   )),
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

-- ─── Activities ───────────────────────────────────────────────
create table if not exists public.activities (
  id               uuid primary key default uuid_generate_v4(),
  lead_id          uuid not null references public.leads(id) on delete cascade,
  type             text not null
                   check (type in (
                     'email_outbound','email_inbound','whatsapp_log',
                     'call','meeting','note','stage_change','site_visit'
                   )),
  subject          text,
  body             text,
  direction        text check (direction in ('inbound','outbound')),
  duration_minutes integer,
  outcome          text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now() not null,
  metadata         jsonb
);

-- ─── Emails ───────────────────────────────────────────────────
create table if not exists public.emails (
  id                  uuid primary key default uuid_generate_v4(),
  lead_id             uuid not null references public.leads(id) on delete cascade,
  mailjet_message_id  text,
  subject             text not null,
  body                text not null,
  direction           text not null check (direction in ('inbound','outbound')),
  status              text not null default 'sent'
                      check (status in ('sent','delivered','opened','clicked','failed')),
  sent_at             timestamptz default now() not null
);

-- ─── Meetings ─────────────────────────────────────────────────
create table if not exists public.meetings (
  id               uuid primary key default uuid_generate_v4(),
  lead_id          uuid not null references public.leads(id) on delete cascade,
  teams_event_id   text,
  title            text not null,
  scheduled_at     timestamptz not null,
  duration_minutes integer,
  notes            text,
  created_at       timestamptz default now() not null
);

-- ─── Indexes ──────────────────────────────────────────────────
create index if not exists leads_stage_idx        on public.leads(stage);
create index if not exists leads_created_at_idx   on public.leads(created_at desc);
create index if not exists activities_lead_id_idx on public.activities(lead_id);
create index if not exists activities_created_idx on public.activities(created_at desc);
create index if not exists emails_lead_id_idx     on public.emails(lead_id);
create index if not exists meetings_lead_id_idx   on public.meetings(lead_id);

-- Full-text search index on leads
create index if not exists leads_search_idx on public.leads
  using gin(to_tsvector('english',
    coalesce(contact_name,'') || ' ' ||
    coalesce(company_name,'') || ' ' ||
    coalesce(email,'') || ' ' ||
    coalesce(phone,'') || ' ' ||
    coalesce(city,'')
  ));

-- ─── Row Level Security ───────────────────────────────────────
-- All authenticated users can read/write everything (single role for now)
alter table public.profiles  enable row level security;
alter table public.leads      enable row level security;
alter table public.activities enable row level security;
alter table public.emails     enable row level security;
alter table public.meetings   enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Leads: all authenticated users full access
create policy "leads_all" on public.leads for all to authenticated using (true) with check (true);

-- Activities: all authenticated users full access
create policy "activities_all" on public.activities for all to authenticated using (true) with check (true);

-- Emails: all authenticated users full access
create policy "emails_all" on public.emails for all to authenticated using (true) with check (true);

-- Meetings: all authenticated users full access
create policy "meetings_all" on public.meetings for all to authenticated using (true) with check (true);

-- ─── Done ─────────────────────────────────────────────────────
-- Next: create a user in Supabase Dashboard → Authentication → Users
-- Then copy your project URL and anon key to .env.local

-- ─── Add address column to leads (run if table already exists) ───
alter table public.leads add column if not exists address text;
