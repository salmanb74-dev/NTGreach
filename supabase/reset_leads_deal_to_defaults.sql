-- Apply Settings → Default deal values to ALL CRM leads.
-- Uses current app_settings.deal_quote_defaults (Starter if missing).
-- JSON seed source: lib/subscription-quote.ts — run npm run sync:deal-defaults-sql after changes.
-- Safe to re-run. Run in Supabase SQL Editor.

alter table public.leads
  add column if not exists discount numeric(12,2),
  add column if not exists tax_rate numeric(6,2),
  add column if not exists quoted_subscription jsonb;

-- How many are incomplete before the update
select
  count(*) filter (
    where quoted_subscription is null
       or quoted_subscription = '{}'::jsonb
       or quoted_mrr is null
       or quoted_setup_fee is null
       or deal_currency is null
       or payment_frequency is null
       or not (quoted_subscription ? 'monthlyPrice')
  ) as incomplete_before,
  count(*) as total_leads
from public.leads;

-- Ensure a defaults row exists (does not overwrite saved Settings)
insert into public.app_settings (key, value, updated_at)
values (
  'deal_quote_defaults',
  '{"currency":"USD","billingCycle":"1","subscription":{"monthlyPrice":35,"billingCycle":"1","durationMonths":1,"setupFee":350,"locations":1,"locationsUnlimited":false,"users":50,"usersUnlimited":false,"counters":2,"countersUnlimited":false,"ordersPerMonth":3000,"ordersUnlimited":false,"callCenter":false,"callCenterFee":null,"kds":false,"kdsFee":null,"inventory":false,"inventoryFee":null,"support":false,"supportFee":null,"webOrdering":false,"webOrderingFee":null,"webOrderingRevenuePercent":null,"paidTrial":false,"paidTrialDays":null,"preTrialSetupFee":0,"postTrialSetupFee":0}}',
  now()
)
on conflict (key) do nothing;

with raw as (
  select
    coalesce(nullif(trim(value::jsonb->>'currency'), ''), 'USD') as currency,
    case
      when value::jsonb->>'billingCycle' = 'annual'
        or value::jsonb->>'paymentFrequency' = 'annual'
        or coalesce((value::jsonb #>> '{subscription,durationMonths}')::numeric, 0) >= 12
      then 'annual'
      else 'monthly'
    end as billing_cycle,
    coalesce(value::jsonb->'subscription', value::jsonb) as subscription
  from public.app_settings
  where key = 'deal_quote_defaults'
  limit 1
),
normalized as (
  select
    currency,
    billing_cycle,
    coalesce((subscription->>'paidTrial')::boolean, false) as paid_trial,
    jsonb_build_object(
      'monthlyPrice',       coalesce((subscription->>'monthlyPrice')::numeric, 35),
      'billingCycle',       billing_cycle,
      'durationMonths',     case when billing_cycle = 'annual' then 12 else 1 end,
      'setupFee',
        case
          when coalesce((subscription->>'paidTrial')::boolean, false)
          then 0
          else coalesce((subscription->>'setupFee')::numeric, 350)
        end,
      'locations',          coalesce((subscription->>'locations')::numeric, 1),
      'locationsUnlimited', coalesce((subscription->>'locationsUnlimited')::boolean, false),
      'users',              coalesce((subscription->>'users')::numeric, 50),
      'usersUnlimited',     coalesce((subscription->>'usersUnlimited')::boolean, false),
      'counters',           coalesce((subscription->>'counters')::numeric, 2),
      'countersUnlimited',  coalesce((subscription->>'countersUnlimited')::boolean, false),
      'ordersPerMonth',     coalesce((subscription->>'ordersPerMonth')::numeric, 3000),
      'ordersUnlimited',    coalesce((subscription->>'ordersUnlimited')::boolean, false),
      'callCenter',         coalesce((subscription->>'callCenter')::boolean, false),
      'callCenterFee',      case when nullif(subscription->>'callCenterFee', 'null') is null then null else (subscription->>'callCenterFee')::numeric end,
      'kds',                coalesce((subscription->>'kds')::boolean, false),
      'kdsFee',             case when nullif(subscription->>'kdsFee', 'null') is null then null else (subscription->>'kdsFee')::numeric end,
      'inventory',          coalesce((subscription->>'inventory')::boolean, false),
      'inventoryFee',       case when nullif(subscription->>'inventoryFee', 'null') is null then null else (subscription->>'inventoryFee')::numeric end,
      'support',            coalesce((subscription->>'support')::boolean, false),
      'supportFee',         case when nullif(subscription->>'supportFee', 'null') is null then null else (subscription->>'supportFee')::numeric end,
      'webOrdering',        coalesce((subscription->>'webOrdering')::boolean, false),
      'webOrderingFee',     case when nullif(subscription->>'webOrderingFee', 'null') is null then null else (subscription->>'webOrderingFee')::numeric end,
      'webOrderingRevenuePercent',
        case when nullif(subscription->>'webOrderingRevenuePercent', 'null') is null then null
             else (subscription->>'webOrderingRevenuePercent')::numeric end,
      'paidTrial',          coalesce((subscription->>'paidTrial')::boolean, false),
      'paidTrialDays',
        case when nullif(subscription->>'paidTrialDays', 'null') is null then null
             else (subscription->>'paidTrialDays')::numeric end,
      'preTrialSetupFee',
        case
          when coalesce((subscription->>'paidTrial')::boolean, false)
          then coalesce((subscription->>'preTrialSetupFee')::numeric, 0)
          else 0
        end,
      'postTrialSetupFee',
        case
          when coalesce((subscription->>'paidTrial')::boolean, false)
          then coalesce((subscription->>'postTrialSetupFee')::numeric, 0)
          else 0
        end
    ) as quoted_subscription
  from raw
)
update public.leads l
set
  deal_currency       = n.currency,
  payment_frequency   = n.billing_cycle,
  quoted_subscription = n.quoted_subscription,
  quoted_setup_fee    = (n.quoted_subscription->>'setupFee')::numeric,
  quoted_mrr          = coalesce((n.quoted_subscription->>'monthlyPrice')::numeric, 0)
                        + case when coalesce((n.quoted_subscription->>'callCenter')::boolean, false)
                               then coalesce((n.quoted_subscription->>'callCenterFee')::numeric, 0) else 0 end
                        + case when coalesce((n.quoted_subscription->>'kds')::boolean, false)
                               then coalesce((n.quoted_subscription->>'kdsFee')::numeric, 0) else 0 end
                        + case when coalesce((n.quoted_subscription->>'inventory')::boolean, false)
                               then coalesce((n.quoted_subscription->>'inventoryFee')::numeric, 0) else 0 end
                        + case when coalesce((n.quoted_subscription->>'support')::boolean, false)
                               then coalesce((n.quoted_subscription->>'supportFee')::numeric, 0) else 0 end
from normalized n;

-- After check
select
  count(*) filter (
    where quoted_subscription is null
       or quoted_mrr is null
       or quoted_setup_fee is null
       or deal_currency is null
       or payment_frequency is null
       or not (quoted_subscription ? 'monthlyPrice')
  ) as incomplete_after,
  count(*) as total_leads,
  min(deal_currency) as currency,
  min(quoted_mrr) as platform_fee_total,
  min(quoted_setup_fee) as setup_fee,
  min(payment_frequency) as billing_cycle
from public.leads;
