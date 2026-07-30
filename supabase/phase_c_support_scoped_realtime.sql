-- Resto Support: conversation-scoped Supabase Realtime access
--
-- PREREQUISITES:
--   1. Run phase_support_migration.sql
--   2. Run phase_c_support_realtime.sql
--   3. Set Reach SUPABASE_JWT_SECRET to the project's legacy JWT secret
--
-- The API mints a 10-minute JWT whose `role` is support_realtime and whose
-- `support_conversation_id` claim contains exactly one conversation UUID.
--
-- Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'support_realtime') then
    execute 'create role support_realtime nologin';
  end if;
end $$;

-- Supabase's connection role must be able to assume the JWT's database role.
grant support_realtime to authenticator;

grant usage on schema public to support_realtime;
grant select on table public.support_messages to support_realtime;

alter table public.support_messages enable row level security;

drop policy if exists "support_messages_scoped_realtime_select"
  on public.support_messages;

create policy "support_messages_scoped_realtime_select"
  on public.support_messages
  for select
  to support_realtime
  using (
    current_setting('request.jwt.claims', true)::jsonb
      ->> 'support_realtime' = 'true'
    and conversation_id::text =
      current_setting('request.jwt.claims', true)::jsonb
        ->> 'support_conversation_id'
  );

-- Intentionally no grants/policies for INSERT, UPDATE, DELETE, profiles,
-- support_conversations, or any CRM table. All writes continue through Nest BFF.
