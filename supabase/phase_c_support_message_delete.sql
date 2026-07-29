-- Sender-only message delete + Realtime DELETE payload
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

-- Only the sender may delete their own message (text / image / voice).
drop policy if exists "support_messages_delete" on public.support_messages;
create policy "support_messages_delete" on public.support_messages
  for delete to authenticated
  using (
    public.is_cs_agent()
    and sender_id = auth.uid()
  );

-- Include full row on DELETE so Realtime filters (conversation_id) work.
alter table public.support_messages replica identity full;
