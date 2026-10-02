-- Prevent duplicate CRM leads by company/restaurant name (case-insensitive).
-- Run in Supabase SQL editor after resolving any existing duplicate company_name rows.

-- Find duplicates before applying (optional check):
-- select lower(btrim(company_name)) as key, count(*), array_agg(id)
-- from public.leads
-- group by 1
-- having count(*) > 1;

create unique index if not exists leads_company_name_unique_ci
  on public.leads (lower(btrim(company_name)));
