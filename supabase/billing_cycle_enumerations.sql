-- Billing cycles as Lists & Values.
-- Label = suffix in templates ({{billing_cycle}}), e.g. "per year"
-- Value = duration in months ({{duration_months}}), e.g. 12
-- Run in Supabase SQL Editor.

-- payment_frequency used to be monthly|annual only.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.leads'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%payment_frequency%'
  loop
    execute format('alter table public.leads drop constraint %I', r.conname);
  end loop;
end $$;

insert into public.enumerations (category, value, label, sort_order) values
  ('billing_cycle', '1',  'per month',     1),
  ('billing_cycle', '3',  'per quarter',   2),
  ('billing_cycle', '6',  'per 6 months',  3),
  ('billing_cycle', '12', 'per year',      4),
  ('billing_cycle', '24', 'per 2 years',   5),
  ('billing_cycle', '36', 'per 3 years',   6)
on conflict (category, value) do nothing;

update public.leads
set payment_frequency = case
  when payment_frequency in ('annual', 'yearly') then '12'
  when payment_frequency = 'monthly' then '1'
  else payment_frequency
end
where payment_frequency in ('monthly', 'annual', 'yearly');

select category, value, label, sort_order
from public.enumerations
where category = 'billing_cycle'
order by sort_order;
