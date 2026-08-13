-- ============================================================
-- Lead quoted subscription params + deal discount/tax columns
-- Align CRM deal values with Resto Enterprise offer fields
-- ============================================================

alter table public.leads
  add column if not exists discount numeric(12,2),
  add column if not exists tax_rate numeric(6,2),
  add column if not exists quoted_subscription jsonb;

comment on column public.leads.quoted_subscription is
  'Enterprise-style quote: monthlyPrice, durationMonths, setupFee, limits, features, trial (see lib/subscription-quote.ts)';

-- Refresh default quotation template with subscription comparison table
-- (only if the default template still exists; does not overwrite custom renames)
update public.quotation_templates
set content = $q$
<h1 style="text-align:center">QUOTATION</h1>
<p style="text-align:center"><strong>NTG Clarity Networks Inc.</strong><br>
7030 Woodbine Avenue, Suite 500, Markham, Ontario L3R 6G2<br>
info@ntgclarity.com</p>
<hr>
<p><strong>Prepared for:</strong> {{client_name}}<br>
<strong>Address:</strong> {{client_address}}<br>
<strong>Email:</strong> {{client_email}}<br>
<strong>Date:</strong> {{quotation_date}}<br>
<strong>Valid Until:</strong> {{valid_until}}</p>
<h2>Scope of Work</h2>
<p>{{scope_summary}}</p>
<h2>Subscription quote</h2>
<table style="width:100%;border-collapse:collapse">
<thead>
<tr style="background:#f3f4f6">
<th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Item</th>
<th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">Quoted ({{currency}})</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Monthly price</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{monthly_price}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Term (months)</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{duration_months}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Term total</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{term_total}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Setup fee</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Pre-trial setup</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{pre_trial_setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Post-trial setup</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{post_trial_setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Branches</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{branches}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Users</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{users}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Counters</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{counters}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Orders / month</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{orders_per_month}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Call center</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{call_center}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Kitchen display</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{kds}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Inventory</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{inventory}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Support</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{support}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Web ordering</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{web_ordering}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Paid trial</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{paid_trial}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Trial days</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{paid_trial_days}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Access starts</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{access_starts}}</td></tr>
</tbody>
</table>
<h2>First payment summary</h2>
<table style="width:100%;border-collapse:collapse">
<tbody>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Setup / first period</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{currency}} {{setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Term total ({{duration_months}} months)</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{currency}} {{term_total}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Discount</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{currency}} {{discount}} ({{discount_note}})</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Tax</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{currency}} {{tax}} ({{tax_note}})</td></tr>
<tr style="font-weight:bold;background:#f9fafb"><td style="padding:8px 12px;border:1px solid #e5e7eb">Total first payment</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{currency}} {{total_first_payment}}</td></tr>
</tbody>
</table>
<h2>Terms</h2>
<ul>
<li>This quotation is valid until <strong>{{valid_until}}</strong></li>
<li>Prices are in <strong>{{currency}}</strong></li>
<li>Access starts: <strong>{{access_starts}}</strong></li>
<li>Subscription term: <strong>{{contract_term}}</strong></li>
</ul>
<p>&nbsp;</p>
<p>To proceed, please confirm acceptance by replying to this quotation or signing below.</p>
<p>&nbsp;</p>
<p>___________________________<br>Authorized Signature — NTG Clarity Networks Inc.</p>
<p>&nbsp;</p>
<p>___________________________<br>Client Signature — {{client_name}}</p>
$q$,
    updated_at = now()
where is_default = true
  and name = 'NTG Reach — Standard Quotation';

-- Refresh default contract fee section with subscription table
update public.contract_templates
set content = $c$
<h1 style="text-align:center">SAAS SUBSCRIPTION AGREEMENT</h1>
<p style="text-align:center"><strong>NTG Clarity Networks Inc.</strong><br>
7030 Woodbine Avenue, Suite 500, Markham, Ontario L3R 6G2</p>
<p style="text-align:center">Date: {{contract_date}}</p>
<hr>
<p>This Subscription Agreement (&ldquo;Agreement&rdquo;) is entered into as of {{contract_date}} by and between:</p>
<p><strong>NTG Clarity Networks Inc.</strong> (&ldquo;Provider&rdquo;)<br>
and<br>
<strong>{{client_name}}</strong> (&ldquo;Client&rdquo;), of {{client_address}}, email: {{client_email}}.</p>
<h2>1. Subscription Terms</h2>
<p>Provider grants Client access to the NTG Resto platform under the following commercial terms:</p>
<table style="width:100%;border-collapse:collapse">
<thead>
<tr style="background:#f3f4f6">
<th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb">Parameter</th>
<th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb">Value ({{currency}})</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Monthly price</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{monthly_price}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Term (months)</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{duration_months}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Term total</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{term_total}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Setup fee</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Pre-trial setup</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{pre_trial_setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Post-trial setup</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{post_trial_setup_fee}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Branches</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{branches}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Users</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{users}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Counters</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{counters}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Orders / month</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{orders_per_month}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Call center</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{call_center}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Kitchen display</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{kds}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Inventory</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{inventory}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Support</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{support}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Web ordering</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{web_ordering}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Paid trial</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{paid_trial}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Trial days</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{paid_trial_days}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Service start / access</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{access_starts}}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Contract term</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">{{contract_term}}</td></tr>
</tbody>
</table>
<h2>2. Fees and Payment</h2>
<ul>
<li><strong>Setup fee:</strong> {{currency}} {{setup_fee}}</li>
<li><strong>Recurring fee:</strong> {{currency}} {{monthly_price}} per month (term total {{currency}} {{term_total}} for {{duration_months}} months)</li>
<li>Billing frequency reference: per {{payment_frequency}}</li>
</ul>
<h2>3. Term</h2>
<p>This Agreement begins on {{start_date}} (or access date {{access_starts}}) and continues for {{contract_term}}, unless terminated earlier in accordance with its terms.</p>
<h2>4. Acceptance</h2>
<table style="width:100%;border-collapse:collapse;margin-top:24px">
<tr>
<td style="width:50%;padding:12px;vertical-align:top">
<strong>Provider</strong><br><br>
___________________________<br>
NTG Clarity Networks Inc.<br>
Date: _______________
</td>
<td style="width:50%;padding:12px;vertical-align:top">
<strong>Client</strong><br><br>
___________________________<br>
{{client_name}}<br>
Date: _______________
</td>
</tr>
</table>
$c$,
    updated_at = now()
where is_default = true
  and name = 'NTG Reach — SaaS Subscription Agreement';

-- Default deal values for new leads (Starter plan commercial terms)
-- Editable later from Settings → General → Default deal values
insert into public.app_settings (key, value, updated_at)
values (
  'deal_quote_defaults',
  '{"currency":"USD","billingCycle":"monthly","subscription":{"monthlyPrice":35,"billingCycle":"monthly","durationMonths":1,"setupFee":350,"locations":1,"locationsUnlimited":false,"users":50,"usersUnlimited":false,"counters":2,"countersUnlimited":false,"ordersPerMonth":3000,"ordersUnlimited":false,"callCenter":false,"callCenterFee":null,"kds":false,"kdsFee":null,"inventory":false,"inventoryFee":null,"support":false,"supportFee":null,"webOrdering":false,"webOrderingFee":null,"webOrderingRevenuePercent":null,"paidTrial":false,"paidTrialDays":null,"preTrialSetupFee":0,"postTrialSetupFee":0}}',
  now()
)
on conflict (key) do nothing;
