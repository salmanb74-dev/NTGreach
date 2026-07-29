-- ============================================================
-- NTG Reach — Support Module (Phase B) Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Helper: CS agent / admin checks ──────────────────────────
create or replace function public.is_cs_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and roles && array['cs_support_rep', 'cs_manager', 'cs_admin']
  );
$$;

create or replace function public.is_cs_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and roles && array['cs_admin']
  );
$$;

-- ─── 1. support_conversations ─────────────────────────────────
create table if not exists public.support_conversations (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    text not null,
  tenant_name  text not null,
  title        text,
  status       text not null default 'open'
               check (status in ('open', 'closed')),
  created_by   uuid not null references auth.users(id),
  assigned_to  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  product      text not null default 'resto',
  last_message_at timestamptz not null default now(),
  support_category text not null default 'platform'
                   check (support_category in ('platform', 'operational')),
  logged_minutes integer not null default 0
                 check (logged_minutes >= 0 and logged_minutes % 5 = 0)
);

create index if not exists support_conversations_status_idx
  on public.support_conversations (status);
create index if not exists support_conversations_assigned_idx
  on public.support_conversations (assigned_to);
create index if not exists support_conversations_product_idx
  on public.support_conversations (product);

alter table public.support_conversations enable row level security;

create policy "support_conversations_select" on public.support_conversations
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_conversations_insert" on public.support_conversations
  for insert to authenticated
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and created_by = auth.uid())
  );

create policy "support_conversations_update" on public.support_conversations
  for update to authenticated
  using (public.is_cs_agent())
  with check (public.is_cs_agent());

create policy "support_conversations_delete" on public.support_conversations
  for delete to authenticated
  using (public.is_cs_agent());

-- ─── 2. support_messages ──────────────────────────────────────
create table if not exists public.support_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  sender_type     text not null check (sender_type in ('agent', 'customer')),
  message_type    text not null check (message_type in ('text', 'image', 'voice', 'video')),
  content         text,
  file_url        text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  expires_at      timestamptz
);

create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

alter table public.support_messages enable row level security;

create policy "support_messages_select" on public.support_messages
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_messages_insert" on public.support_messages
  for insert to authenticated
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and sender_id = auth.uid())
  );

create policy "support_messages_update" on public.support_messages
  for update to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and sender_id = auth.uid())
  )
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and sender_id = auth.uid())
  );

create policy "support_messages_delete" on public.support_messages
  for delete to authenticated
  using (
    public.is_cs_agent()
    and sender_id = auth.uid()
  );

-- ─── 3. support_participants ──────────────────────────────────
create table if not exists public.support_participants (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id),
  joined_at       timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists support_participants_user_idx
  on public.support_participants (user_id);

alter table public.support_participants enable row level security;

create policy "support_participants_select" on public.support_participants
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_participants_insert" on public.support_participants
  for insert to authenticated
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and user_id = auth.uid())
  );

create policy "support_participants_update" on public.support_participants
  for update to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and user_id = auth.uid())
  )
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and user_id = auth.uid())
  );

create policy "support_participants_delete" on public.support_participants
  for delete to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and user_id = auth.uid())
  );

-- ─── 4. support_shifts ────────────────────────────────────────
create table if not exists public.support_shifts (
  id          uuid primary key default uuid_generate_v4(),
  agent_id    uuid not null references auth.users(id),
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists support_shifts_agent_idx
  on public.support_shifts (agent_id, start_at);

alter table public.support_shifts enable row level security;

create policy "support_shifts_select" on public.support_shifts
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_shifts_insert" on public.support_shifts
  for insert to authenticated
  with check (public.is_cs_admin_user());

create policy "support_shifts_update" on public.support_shifts
  for update to authenticated
  using (public.is_cs_admin_user())
  with check (public.is_cs_admin_user());

create policy "support_shifts_delete" on public.support_shifts
  for delete to authenticated
  using (public.is_cs_admin_user());

-- ─── 5. support_time_logs ─────────────────────────────────────
create table if not exists public.support_time_logs (
  id          uuid primary key default uuid_generate_v4(),
  agent_id    uuid not null references auth.users(id),
  clock_in    timestamptz not null,
  clock_out   timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists support_time_logs_agent_idx
  on public.support_time_logs (agent_id, clock_in);

alter table public.support_time_logs enable row level security;

create policy "support_time_logs_select" on public.support_time_logs
  for select to authenticated
  using (public.is_cs_agent());

create policy "support_time_logs_insert" on public.support_time_logs
  for insert to authenticated
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

create policy "support_time_logs_update" on public.support_time_logs
  for update to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  )
  with check (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

create policy "support_time_logs_delete" on public.support_time_logs
  for delete to authenticated
  using (
    public.is_cs_admin_user()
    or (public.is_cs_agent() and agent_id = auth.uid())
  );

-- ─── 6. support_ratings ───────────────────────────────────────
create table if not exists public.support_ratings (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  score           integer not null check (score >= 1 and score <= 5),
  comment         text,
  rated_at        timestamptz not null default now()
);

create index if not exists support_ratings_conversation_idx
  on public.support_ratings (conversation_id);

alter table public.support_ratings enable row level security;

create policy "support_ratings_select" on public.support_ratings
  for select to authenticated
  using (public.is_cs_agent());

-- No row owner column — any CS agent may insert; only cs_admin may update/delete
create policy "support_ratings_insert" on public.support_ratings
  for insert to authenticated
  with check (public.is_cs_agent());

create policy "support_ratings_update" on public.support_ratings
  for update to authenticated
  using (public.is_cs_admin_user())
  with check (public.is_cs_admin_user());

create policy "support_ratings_delete" on public.support_ratings
  for delete to authenticated
  using (public.is_cs_admin_user());

-- Keep last_message_at in sync when messages are inserted
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
