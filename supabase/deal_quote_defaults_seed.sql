-- Seed Starter-plan deal defaults for new leads (if not already set).
-- Key is editable from Settings → General.
insert into public.app_settings (key, value, updated_at)
values (
  'deal_quote_defaults',
  '{"currency":"USD","billingCycle":"monthly","subscription":{"monthlyPrice":35,"billingCycle":"monthly","durationMonths":1,"setupFee":350,"locations":1,"locationsUnlimited":false,"users":50,"usersUnlimited":false,"counters":2,"countersUnlimited":false,"ordersPerMonth":3000,"ordersUnlimited":false,"callCenter":false,"callCenterFee":null,"kds":false,"kdsFee":null,"inventory":false,"inventoryFee":null,"support":false,"supportFee":null,"webOrdering":false,"webOrderingFee":null,"webOrderingRevenuePercent":null,"paidTrial":false,"paidTrialDays":null,"preTrialSetupFee":0,"postTrialSetupFee":0}}',
  now()
)
on conflict (key) do nothing;
