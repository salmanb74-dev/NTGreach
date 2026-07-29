-- Support chat classification + manual logged minutes
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

-- platform = product/platform issues; operational = day-to-day ops help
alter table public.support_conversations
  add column if not exists support_category text not null default 'platform';

alter table public.support_conversations
  drop constraint if exists support_conversations_support_category_check;

alter table public.support_conversations
  add constraint support_conversations_support_category_check
  check (support_category in ('platform', 'operational'));

-- Manual minutes logged against the chat (multiples of 5)
alter table public.support_conversations
  add column if not exists logged_minutes integer not null default 0;

alter table public.support_conversations
  drop constraint if exists support_conversations_logged_minutes_check;

alter table public.support_conversations
  add constraint support_conversations_logged_minutes_check
  check (logged_minutes >= 0 and logged_minutes % 5 = 0);

-- Any CS agent can update conversations (category / minutes / title),
-- not only the creator — needed so any rep can reclassify a chat.
drop policy if exists "support_conversations_update" on public.support_conversations;

create policy "support_conversations_update" on public.support_conversations
  for update to authenticated
  using (public.is_cs_agent())
  with check (public.is_cs_agent());
