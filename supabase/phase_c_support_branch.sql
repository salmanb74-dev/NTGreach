-- Originating branch for support chats (Resto multi-branch).
-- Existing rows stay NULL; only new conversations from Nest will set these.

alter table public.support_conversations
  add column if not exists branch_id text,
  add column if not exists branch_name text;

comment on column public.support_conversations.branch_id is
  'Resto branch UUID at chat open; null = unknown / pre-branch / HQ';

comment on column public.support_conversations.branch_name is
  'Display label snapshotted at create (e.g. Gulberg); null when branch_id is null';

create index if not exists support_conversations_branch_id_idx
  on public.support_conversations (tenant_id, branch_id);
