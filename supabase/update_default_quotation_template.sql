-- Update default quotation template (subscription table only; no discount/tax/first-payment vars).
-- Run in Supabase SQL Editor. Updates every is_default quotation template.
--
-- ⚠️  WARNING: This OVERWRITES the full HTML content of your default template.
-- If you customized the template in Settings (formulas, {{#if}}, column widths),
-- do NOT run this — edit the template in the UI instead.
-- Supabase does not keep template version history unless you use PITR/backups.

update public.quotation_templates
set
  content = $q$
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
<p>All amounts in <strong>{{currency}}</strong> unless noted.</p>
<table style="width:100%;border-collapse:collapse;margin:6px 0;font-size:11px">
<thead>
<tr style="background:#f3f4f6">
<th style="padding:3px 6px;text-align:left;border:1px solid #e5e7eb;line-height:1.25;font-weight:600">Item</th>
<th style="padding:3px 6px;text-align:right;border:1px solid #e5e7eb;line-height:1.25;font-weight:600">Quoted</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Platform fee</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{platform_fee}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Billing cycle</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{billing_cycle}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Setup fee</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{setup_fee}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Pre-trial setup</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{pre_trial_setup_fee}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Post-trial setup</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{post_trial_setup_fee}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Branches</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{branches}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Users</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{users}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Counters</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{counters}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Orders / month</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{orders_per_month}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Call center / mo</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{call_center}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Kitchen display / mo</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{kds}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Inventory / mo</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{inventory}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Ops support / mo</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{ops_support}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Web ordering / mo</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{web_ordering}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Web ordering revenue %</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{web_ordering_revenue_pct}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Paid trial</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{paid_trial}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Trial days</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{paid_trial_days}}</td></tr>
<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;line-height:1.25">Trial starts</td><td style="padding:3px 6px;border:1px solid #e5e7eb;text-align:right;line-height:1.25">{{trial_starts}}</td></tr>
</tbody>
</table>
<h2>Terms</h2>
<ul>
<li>This quotation is valid until <strong>{{valid_until}}</strong></li>
<li>Prices are in <strong>{{currency}}</strong></li>
<li>Billing cycle: <strong>{{billing_cycle}}</strong> ({{contract_term}})</li>
<li>Trial starts: <strong>{{trial_starts}}</strong></li>
</ul>
<p>&nbsp;</p>
<p>To proceed, please confirm acceptance by replying to this quotation or signing below.</p>
<p>&nbsp;</p>
<p>___________________________<br>Authorized Signature — NTG Clarity Networks Inc.</p>
<p>&nbsp;</p>
<p>___________________________<br>Client Signature — {{client_name}}</p>
$q$,
  updated_at = now()
where is_default = true;

-- Confirm
select id, name, is_default, length(content) as content_len, updated_at
from public.quotation_templates
where is_default = true;
