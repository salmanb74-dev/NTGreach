-- Run this in Supabase Dashboard → SQL Editor
-- Adds address field to existing leads table

alter table public.leads add column if not exists address text;
