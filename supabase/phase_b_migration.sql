-- ============================================================
-- NTG Reach — Phase B Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

alter table public.leads
  add column if not exists quoted_setup_fee    numeric(12,2),
  add column if not exists quoted_mrr          numeric(12,2),
  add column if not exists deal_currency       text default 'PKR',
  add column if not exists closed_at           timestamptz,
  add column if not exists payment_start_date  timestamptz,
  add column if not exists payment_frequency   text check (payment_frequency in ('monthly', 'annual'));
