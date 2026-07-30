-- Fix: support_conversations was missing from the supabase_realtime publication,
-- so agents never received INSERT/UPDATE events for conversations (new chats
-- created by the Resto Support API did not appear in the inbox without a refresh).
--
-- support_messages was already published, which is why chat messages worked.
--
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run.

do $$
begin
  alter publication supabase_realtime add table public.support_conversations;
exception
  when duplicate_object then null;
end $$;

-- UPDATE payloads only contain the primary key unless replica identity is full,
-- which the inbox needs for title / category / logged_minutes changes.
alter table public.support_conversations replica identity full;

-- Verify: both tables must be listed.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('support_conversations', 'support_messages')
order by tablename;
