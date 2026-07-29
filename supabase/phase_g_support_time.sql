-- Phase G: Support time logging — one open clock-in per agent
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run.

create unique index if not exists support_time_logs_one_open_per_agent
  on public.support_time_logs (agent_id)
  where clock_out is null;
