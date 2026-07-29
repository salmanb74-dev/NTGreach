-- Add last_message_at for conversation sorting
-- Run in: Supabase Dashboard → SQL Editor

alter table public.support_conversations
  add column if not exists last_message_at timestamptz default now();

-- Backfill from existing messages (falls back to created_at)
update public.support_conversations c
set last_message_at = coalesce(
  (select max(m.created_at) from public.support_messages m where m.conversation_id = c.id),
  c.created_at,
  now()
);

create or replace function public.update_conversation_last_message()
returns trigger as $$
begin
  update public.support_conversations
  set last_message_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_new_support_message on public.support_messages;
create trigger on_new_support_message
  after insert on public.support_messages
  for each row execute procedure public.update_conversation_last_message();
