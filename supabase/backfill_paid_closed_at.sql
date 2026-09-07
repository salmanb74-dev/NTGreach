-- Backfill dates on Paid leads so Reports can attribute them to a quarter.
-- Prefer existing payment_start_date; otherwise stamp closed_at from updated_at.

update public.leads
set closed_at = coalesce(closed_at, updated_at, created_at, now())
where stage = 'payment_received'
  and closed_at is null;

-- Optional: if subscription start was never set, copy closed_at so Deal Panel shows a date
update public.leads
set payment_start_date = coalesce(payment_start_date, closed_at)
where stage = 'payment_received'
  and payment_start_date is null;
