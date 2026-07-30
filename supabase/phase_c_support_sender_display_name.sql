-- Optional display name for customer messages from the Resto Support API.
-- Safe to re-run.

alter table public.support_messages
  add column if not exists sender_display_name text;
