-- Allow generic file attachments in support chat (PDF, audio, docs, etc.).
-- Images / voice / video keep their existing message_type values.

alter table public.support_messages
  drop constraint if exists support_messages_message_type_check;

alter table public.support_messages
  add constraint support_messages_message_type_check
  check (message_type in ('text', 'image', 'voice', 'video', 'file'));
