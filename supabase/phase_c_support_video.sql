-- Support chat: screen recordings (video) + 7-day expiry
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

-- Allow video message type
alter table public.support_messages
  drop constraint if exists support_messages_message_type_check;

alter table public.support_messages
  add constraint support_messages_message_type_check
  check (message_type in ('text', 'image', 'voice', 'video'));

-- Auto-delete screen recordings after this timestamp
alter table public.support_messages
  add column if not exists expires_at timestamptz;

create index if not exists support_messages_expires_idx
  on public.support_messages (expires_at)
  where expires_at is not null and file_url is not null;
