-- Allow logging site visits as activities
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

alter table public.activities
  drop constraint if exists activities_type_check;

alter table public.activities
  add constraint activities_type_check
  check (type in (
    'email_outbound',
    'email_inbound',
    'whatsapp_log',
    'call',
    'meeting',
    'note',
    'stage_change',
    'site_visit'
  ));
