-- Allow any CS agent to delete conversations (mistaken customer chats, etc.)
-- Run in: Supabase Dashboard → SQL Editor

drop policy if exists "support_conversations_delete" on public.support_conversations;

create policy "support_conversations_delete" on public.support_conversations
  for delete to authenticated
  using (public.is_cs_agent());
