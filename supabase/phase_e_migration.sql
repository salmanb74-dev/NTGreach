-- ============================================================
-- NTG Reach — Phase E Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.contract_templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  content     text not null,  -- HTML from TipTap
  is_default  boolean default false,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table if not exists public.contracts (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid references public.leads(id) on delete set null,
  template_id   uuid references public.contract_templates(id) on delete set null,
  name          text not null,
  content       text not null,  -- rendered HTML with variables substituted
  variables     jsonb,          -- snapshot of variables used
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now() not null
);

alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;

create policy "contract_templates_select" on public.contract_templates
  for select to authenticated using (true);

create policy "contract_templates_write" on public.contract_templates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['admin','manager']
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and roles && array['admin','manager']
    )
  );

create policy "contracts_select" on public.contracts
  for select to authenticated using (true);

create policy "contracts_write" on public.contracts
  for all to authenticated using (true) with check (true);

-- Auto-update updated_at on templates
drop trigger if exists contract_templates_updated_at on public.contract_templates;
create trigger contract_templates_updated_at
  before update on public.contract_templates
  for each row execute procedure public.set_updated_at();

-- Seed default NTG Reach SaaS contract template
insert into public.contract_templates (name, content, is_default) values (
  'NTG Reach — SaaS Subscription Agreement',
  '<h1>SOFTWARE SUBSCRIPTION AGREEMENT</h1>
<p>This Software Subscription Agreement (the <strong>"Agreement"</strong>) is entered into as of <strong>{{contract_date}}</strong> between:</p>
<p><strong>NTG Clarity Networks Inc.</strong>, a corporation incorporated under the laws of Ontario, Canada, with its principal office at 7030 Woodbine Avenue, Suite 500, Markham, Ontario L3R 6G2 (<strong>"Provider"</strong>), and</p>
<p><strong>{{client_name}}</strong>, located at {{client_address}} (<strong>"Client"</strong>).</p>
<h2>1. Services</h2>
<p>Provider agrees to provide Client with access to <strong>NTG Reach</strong>, a cloud-based CRM and sales management platform (the <strong>"Software"</strong>). The subscription includes platform access, standard support, and software updates during the subscription term.</p>
<h2>2. Fees and Payment</h2>
<p>Client agrees to pay Provider the following fees:</p>
<ul>
<li><strong>One-time Setup Fee:</strong> {{currency}} {{setup_fee}}</li>
<li><strong>Recurring Subscription Fee:</strong> {{currency}} {{recurring_fee}} per {{payment_frequency}}</li>
<li><strong>Subscription Start Date:</strong> {{start_date}}</li>
</ul>
<p>All invoices are due within <strong>30 days</strong> of issuance. Late payments are subject to a 1.5% monthly interest charge.</p>
<h2>3. Term and Termination</h2>
<p>This Agreement commences on {{start_date}} and continues for an initial term of <strong>{{contract_term}}</strong>. Either party may terminate this Agreement with <strong>30 days written notice</strong> after the initial term. Provider may terminate immediately upon material breach by Client.</p>
<h2>4. Support</h2>
<p>Provider will provide standard technical support via email during business hours (Monday–Friday, 9 AM–5 PM Eastern Time). Support is included in the subscription fee at no additional charge.</p>
<h2>5. Data and Confidentiality</h2>
<p>Provider will maintain reasonable security measures to protect Client data. Client data remains the property of the Client. Provider will not sell or share Client data with third parties except as required by law.</p>
<h2>6. Limitation of Liability</h2>
<p>Provider''s total liability under this Agreement shall not exceed the fees paid by Client in the three months preceding the claim. Neither party shall be liable for indirect, incidental, or consequential damages.</p>
<h2>7. Governing Law</h2>
<p>This Agreement is governed by the laws of the Province of Ontario, Canada. Any disputes shall be resolved in the courts of Ontario.</p>
<h2>8. Entire Agreement</h2>
<p>This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements.</p>
<p>&nbsp;</p>
<p><strong>IN WITNESS WHEREOF</strong>, the parties have executed this Agreement as of the date first written above.</p>
<p>&nbsp;</p>
<table>
<tbody>
<tr>
<td style="width:50%;padding-right:40px;vertical-align:top;">
<p><strong>NTG Clarity Networks Inc.</strong><br>Signature: ___________________________<br>Name: ___________________________<br>Title: ___________________________<br>Date: ___________________________</p>
</td>
<td style="width:50%;vertical-align:top;">
<p><strong>{{client_name}}</strong><br>Signature: ___________________________<br>Name: ___________________________<br>Title: ___________________________<br>Date: ___________________________</p>
</td>
</tr>
</tbody>
</table>',
  true
) on conflict do nothing;
