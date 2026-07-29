-- Enable Realtime for support chat
-- Run in: Supabase Dashboard → SQL Editor
--
-- PREREQUISITE: run supabase/phase_support_migration.sql first
--
-- Also verify in Dashboard → Database → Replication that these tables
-- are enabled for supabase_realtime:
--   • support_messages
--   • support_conversations
--
-- Safe to re-run after the tables exist.

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_conversations;
exception
  when duplicate_object then null;
end $$;
