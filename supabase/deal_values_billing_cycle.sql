-- Align stored deal values with billing cycle (monthly | annual).
-- Platform fee stays quoted_mrr (always per month).
-- durationMonths is derived: 1 monthly, 12 annual.

-- Infer cycle: annual if payment_frequency is annual OR stored term >= 12 months
update public.leads
set
  payment_frequency = case
    when payment_frequency = 'annual' then 'annual'
    when coalesce((quoted_subscription->>'durationMonths')::numeric, 0) >= 12 then 'annual'
    when coalesce((quoted_subscription->>'billingCycle'), '') = 'annual' then 'annual'
    else coalesce(nullif(payment_frequency, ''), 'monthly')
  end
where
  quoted_setup_fee is not null
  or quoted_mrr is not null
  or quoted_subscription is not null
  or payment_frequency is not null;

update public.leads
set quoted_subscription = coalesce(quoted_subscription, '{}'::jsonb)
  || jsonb_build_object(
    'billingCycle',
    case when payment_frequency = 'annual' then 'annual' else 'monthly' end,
    'durationMonths',
    case when payment_frequency = 'annual' then 12 else 1 end
  )
where
  quoted_setup_fee is not null
  or quoted_mrr is not null
  or quoted_subscription is not null
  or payment_frequency is not null;

-- Refresh saved defaults JSON
update public.app_settings
set
  value = jsonb_set(
    jsonb_set(
      jsonb_set(
        value::jsonb,
        '{billingCycle}',
        to_jsonb(
          case
            when value::jsonb->>'billingCycle' = 'annual'
              or value::jsonb->>'paymentFrequency' = 'annual'
              or coalesce((value::jsonb #>> '{subscription,durationMonths}')::numeric, 0) >= 12
            then 'annual'
            else 'monthly'
          end
        )
      ),
      '{subscription,billingCycle}',
      to_jsonb(
        case
          when value::jsonb->>'billingCycle' = 'annual'
            or value::jsonb->>'paymentFrequency' = 'annual'
            or coalesce((value::jsonb #>> '{subscription,durationMonths}')::numeric, 0) >= 12
          then 'annual'
          else 'monthly'
        end
      )
    ),
    '{subscription,durationMonths}',
    to_jsonb(
      case
        when value::jsonb->>'billingCycle' = 'annual'
          or value::jsonb->>'paymentFrequency' = 'annual'
          or coalesce((value::jsonb #>> '{subscription,durationMonths}')::numeric, 0) >= 12
        then 12
        else 1
      end
    )
  )::text,
  updated_at = now()
where key = 'deal_quote_defaults'
  and value is not null
  and left(trim(value), 1) = '{';

-- Relabel placeholders in default templates (best-effort)
update public.quotation_templates
set content = replace(
  replace(
    replace(
      replace(
        replace(
          replace(content, '{{monthly_price}}', '{{platform_fee}}'),
          '{{access_starts}}', '{{trial_starts}}'
        ),
        '{{support}}', '{{ops_support}}'
      ),
      'Monthly price', 'Platform fee (per month)'
    ),
    'Access starts', 'Trial starts'
  ),
  '>Support<', '>Ops support<'
),
    updated_at = now()
where is_default = true;

update public.contract_templates
set content = replace(
  replace(
    replace(
      replace(
        replace(
          replace(content, '{{monthly_price}}', '{{platform_fee}}'),
          '{{access_starts}}', '{{trial_starts}}'
        ),
        '{{support}}', '{{ops_support}}'
      ),
      'Monthly price', 'Platform fee (per month)'
    ),
    'Access starts', 'Trial starts'
  ),
  '>Support<', '>Ops support<'
),
    updated_at = now()
where is_default = true;
