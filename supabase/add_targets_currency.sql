-- ============================================================
-- Add currency column to targets (from Phase D2)
-- Run in: Supabase Dashboard → SQL Editor
-- Fixes: Could not find the 'currency' column of 'targets'
-- ============================================================

alter table public.targets
  add column if not exists currency text default 'PKR';

-- Backfill from Settings → input currency when present
update public.targets
set currency = coalesce(
  (select value from public.app_settings where key = 'input_currency'),
  'PKR'
)
where currency is null or currency = '';

-- Reload PostgREST schema cache (optional; Dashboard may do this automatically)
notify pgrst, 'reload schema';
