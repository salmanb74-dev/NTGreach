-- ============================================================
-- NTG Reach — Phase F Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.quotation_templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  content     text not null,
  is_default  boolean default false,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table if not exists public.quotations (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid references public.leads(id) on delete set null,
  template_id   uuid references public.quotation_templates(id) on delete set null,
  name          text not null,
  content       text not null,
  variables     jsonb,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now() not null
);

alter table public.quotation_templates enable row level security;
alter table public.quotations enable row level security;

create policy "quotation_templates_select" on public.quotation_templates
  for select to authenticated using (true);

create policy "quotation_templates_write" on public.quotation_templates
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and roles && array['admin','manager']))
  with check (exists (select 1 from public.profiles where id = auth.uid() and roles && array['admin','manager']));

create policy "quotations_select" on public.quotations
  for select to authenticated using (true);

create policy "quotations_write" on public.quotations
  for all to authenticated using (true) with check (true);

drop trigger if exists quotation_templates_updated_at on public.quotation_templates;
create trigger quotation_templates_updated_at
  before update on public.quotation_templates
  for each row execute procedure public.set_updated_at();

insert into public.quotation_templates (name, content, is_default) values (
  'NTG Reach — Standard Quotation',
  '<h1 style="text-align:center">QUOTATION</h1><p style="text-align:center"><strong>NTG Clarity Networks Inc.</strong><br>7030 Woodbine Avenue, Suite 500, Markham, Ontario L3R 6G2<br>info@ntgclarity.com</p><hr><p><strong>Prepared for:</strong> {{client_name}}<br><strong>Address:</strong> {{client_address}}<br><strong>Email:</strong> {{client_email}}<br><strong>Date:</strong> {{quotation_date}}<br><strong>Valid Until:</strong> {{valid_until}}</p><h2>Scope of Work</h2><p>{{scope_summary}}</p><h2>Pricing</h2><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Item</th><th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Description</th><th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">Amount</th></tr></thead><tbody><tr><td style="padding:8px 12px;border:1px solid #e5e7eb">One-time Setup Fee</td><td style="padding:8px 12px;border:1px solid #e5e7eb">Platform setup, configuration and onboarding</td><td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">{{currency}} {{setup_fee}}</td></tr><tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Recurring Subscription</td><td style="padding:8px 12px;border:1px solid #e5e7eb">NTG Reach platform access, updates and support</td><td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">{{currency}} {{recurring_fee}} / {{payment_frequency}}</td></tr><tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Discount</td><td style="padding:8px 12px;border:1px solid #e5e7eb">{{discount_note}}</td><td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">{{currency}} {{discount}}</td></tr><tr style="font-weight:bold;background:#f9fafb"><td colspan="2" style="padding:8px 12px;border:1px solid #e5e7eb">Total First Payment</td><td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">{{currency}} {{total_first_payment}}</td></tr></tbody></table><h2>What is Included</h2><ul><li>Full access to NTG Reach CRM platform</li><li>Onboarding and setup assistance</li><li>Email and phone support during business hours</li><li>Software updates throughout the subscription term</li></ul><h2>Terms</h2><ul><li>This quotation is valid until <strong>{{valid_until}}</strong></li><li>Prices are in <strong>{{currency}}</strong></li><li>Payment is due within 30 days of invoice</li><li>Subscription renews automatically on a {{payment_frequency}} basis</li></ul><p>&nbsp;</p><p>To proceed, please confirm acceptance by replying to this quotation or signing below.</p><p>&nbsp;</p><p>___________________________<br>Authorized Signature — NTG Clarity Networks Inc.</p><p>&nbsp;</p><p>___________________________<br>Client Signature — {{client_name}}</p>',
  true
) on conflict do nothing;
