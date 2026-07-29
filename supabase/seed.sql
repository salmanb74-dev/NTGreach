-- ============================================================
-- NTG Reach — Seed Data
-- 10 realistic Pakistani restaurant leads (Karachi + Hyderabad)
-- Run in: Supabase Dashboard → SQL Editor
-- NOTE: Run this AFTER schema.sql and AFTER creating your user.
-- Replace the created_by UUID below with your actual user ID.
-- Find it in: Supabase Dashboard → Authentication → Users
-- ============================================================

-- Step 1: Paste your user ID here
DO $$
DECLARE
  v_user_id uuid := 'YOUR-USER-ID-HERE'; -- ← replace this

  lead1  uuid := uuid_generate_v4();
  lead2  uuid := uuid_generate_v4();
  lead3  uuid := uuid_generate_v4();
  lead4  uuid := uuid_generate_v4();
  lead5  uuid := uuid_generate_v4();
  lead6  uuid := uuid_generate_v4();
  lead7  uuid := uuid_generate_v4();
  lead8  uuid := uuid_generate_v4();
  lead9  uuid := uuid_generate_v4();
  lead10 uuid := uuid_generate_v4();

BEGIN

-- ─── Insert Leads ─────────────────────────────────────────────
INSERT INTO public.leads
  (id, contact_name, company_name, email, phone, city, restaurant_type, source, stage, notes, created_by, created_at)
VALUES
  (lead1,  'Bilal Farooq',    'Kolachi Grill',          'bilal@kolachigrillpk.com',   '+92 321 2011234', 'Karachi',   'Fine Dining',        'cold_call',  'demo_scheduled', '4 branches across DHA and Clifton. Currently using manual Excel sheets. Very interested in table management and POS integration. Decision maker is Bilal directly.', v_user_id, now() - interval '18 days'),
  (lead2,  'Sana Mirza',      'Chai Wala Express',      'sana@chaiwalaexpress.pk',    '+92 300 9871122', 'Karachi',   'Café / Coffee Shop', 'linkedin',   'proposal_sent',  'Fast-growing café chain, 6 outlets. Sana is the COO. Wants cloud-based reporting and franchise management. Sent proposal on 3rd, waiting for response.', v_user_id, now() - interval '25 days'),
  (lead3,  'Tariq Mahmood',   'Savour Foods Hyderabad', 'tariq@savourfoods.com.pk',   '+92 333 3612345', 'Hyderabad', 'Fast Food Chain',    'referral',   'contacted',      'Referred by Bilal Farooq. 3 branches in Hyderabad. Tariq is the owner. Interested but cautious about switching from their current system.', v_user_id, now() - interval '10 days'),
  (lead4,  'Nida Hussain',    'The Biryani Project',    'nida@thebiryaniproject.pk',  '+92 311 5554433', 'Karachi',   'Casual Dining',      'cold_email', 'new',            'Cloud kitchen with strong Instagram presence. 2 locations in Gulshan and PECHS. Nida handles all ops herself.', v_user_id, now() - interval '3 days'),
  (lead5,  'Imran Qureshi',   'Hyderabadi Dawat',       'imran@hyderabadidawat.com',  '+92 345 7778899', 'Hyderabad', 'Casual Dining',      'cold_call',  'negotiation',    'Heritage restaurant brand, 15 years old, 5 branches. Imran is the second-generation owner. Very interested, negotiating on pricing for the full suite.', v_user_id, now() - interval '35 days'),
  (lead6,  'Zara Sheikh',     'Bun Kabab Co.',          'zara@bunkababco.pk',         '+92 322 1239876', 'Karachi',   'Fast Food Chain',    'event',      'closed_won',     'Met at PFFA expo in March. Quick decision maker. Signed up for 3 branches. Go-live scheduled for next month.', v_user_id, now() - interval '45 days'),
  (lead7,  'Hamza Raza',      'Desi Dhaaba Karachi',    'hamza@desidhaaba.pk',        '+92 300 4445566', 'Karachi',   'Casual Dining',      'cold_call',  'closed_lost',    'Budget constraints cited. Said they will revisit in Q4. Keep warm for follow-up.', v_user_id, now() - interval '60 days'),
  (lead8,  'Fareeha Ansari',  'Sindhi Rasoi',           'fareeha@sindhirasoi.com',    '+92 333 8889900', 'Hyderabad', 'Fine Dining',        'referral',   'contacted',      'Referred by Imran Qureshi. 2-branch traditional Sindhi restaurant. Fareeha is the managing partner. Sent intro email, had one call.', v_user_id, now() - interval '7 days'),
  (lead9,  'Asad Karim',      'Pizza Lahori Karachi',   'asad@pizzalahori.pk',        '+92 321 7776655', 'Karachi',   'Fast Food Chain',    'linkedin',   'demo_scheduled', 'Karachi franchise of a Lahore-based chain. Asad manages the Karachi ops. Wants a demo focused on multi-branch inventory and sales reporting.', v_user_id, now() - interval '12 days'),
  (lead10, 'Rubina Siddiqui', 'Mithai Palace',          'rubina@mithaipalacehy.com',  '+92 345 1112233', 'Hyderabad', 'Bakery',             'cold_email', 'new',            'Sweets and bakery chain, 3 branches. Rubina is the owner. Interested in order management and delivery tracking. First contact was last week.', v_user_id, now() - interval '5 days');

-- ─── Insert Activities (timeline entries per lead) ────────────
INSERT INTO public.activities
  (lead_id, type, subject, body, direction, duration_minutes, outcome, created_by, created_at)
VALUES
  -- Kolachi Grill (demo scheduled)
  (lead1, 'call',           'Initial outreach call',     'Spoke with Bilal. Very interested. Has 4 branches. Asked for a demo next week.', 'outbound', 18, 'Positive — follow up needed', v_user_id, now() - interval '17 days'),
  (lead1, 'email_outbound', 'NTG Reach — Demo Invite',   'Sent demo calendar invite for Tuesday 3PM.', 'outbound', null, null, v_user_id, now() - interval '15 days'),
  (lead1, 'whatsapp_log',   'WhatsApp note',             'Bilal confirmed demo time on WhatsApp. Said he will bring his ops manager.', null, null, null, v_user_id, now() - interval '14 days'),

  -- Chai Wala Express (proposal sent)
  (lead2, 'email_outbound', 'Introduction — NTG Reach',  'Sent intro email after finding on LinkedIn.', 'outbound', null, null, v_user_id, now() - interval '24 days'),
  (lead2, 'call',           'Discovery call',            'Long call with Sana. Franchise management is top priority. 6 outlets currently. Discussed pricing tiers.', 'outbound', 35, 'Interested — send proposal', v_user_id, now() - interval '20 days'),
  (lead2, 'email_outbound', 'NTG Reach — Proposal',      'Sent full proposal including franchise module and pricing breakdown.', 'outbound', null, null, v_user_id, now() - interval '16 days'),

  -- Savour Foods (contacted)
  (lead3, 'call',           'First call',                'Tariq was cautious. Mentioned they had a bad experience with another software vendor. Kept conversation short. Will try again next week.', 'outbound', 12, 'Call back requested', v_user_id, now() - interval '9 days'),

  -- Hyderabadi Dawat (negotiation)
  (lead5, 'call',           'First outreach',            'Imran interested immediately. Wants full suite — POS, inventory, reservations.', 'outbound', 22, 'Positive — follow up needed', v_user_id, now() - interval '34 days'),
  (lead5, 'email_outbound', 'NTG Reach — Full Proposal', 'Sent enterprise proposal for 5 branches.', 'outbound', null, null, v_user_id, now() - interval '28 days'),
  (lead5, 'call',           'Pricing negotiation call',  'Imran wants a 15% discount for 2-year commitment. Escalated to Salman for approval.', 'outbound', 40, 'Positive — follow up needed', v_user_id, now() - interval '20 days'),
  (lead5, 'whatsapp_log',   'WhatsApp note',             'Imran sent a message asking for final pricing by Friday.', null, null, null, v_user_id, now() - interval '5 days'),

  -- Bun Kabab Co. (closed won)
  (lead6, 'note',           'Lead created',              'Met at PFFA expo.', null, null, null, v_user_id, now() - interval '45 days'),
  (lead6, 'call',           'Post-expo follow up',       'Zara remembered the conversation clearly. Wants to move fast.', 'outbound', 20, 'Interested — send proposal', v_user_id, now() - interval '42 days'),
  (lead6, 'email_outbound', 'Contract sent',             'Sent agreement for 3 branches.', 'outbound', null, null, v_user_id, now() - interval '38 days'),
  (lead6, 'stage_change',   'Stage changed to closed_won', null, null, null, null, v_user_id, now() - interval '30 days'),

  -- Desi Dhaaba (closed lost)
  (lead7, 'call',           'First call',                'Hamza interested but said budget is tight this quarter.', 'outbound', 15, 'Not interested', v_user_id, now() - interval '58 days'),
  (lead7, 'stage_change',   'Stage changed to closed_lost', null, null, null, null, v_user_id, now() - interval '50 days'),

  -- Sindhi Rasoi (contacted)
  (lead8, 'email_outbound', 'Introduction — NTG Reach',  'Intro email sent after referral from Imran.', 'outbound', null, null, v_user_id, now() - interval '7 days'),
  (lead8, 'call',           'Intro call',                'Short call. Fareeha is interested but wants to see a demo first. Will schedule next week.', 'outbound', 10, 'Positive — follow up needed', v_user_id, now() - interval '6 days'),

  -- Pizza Lahori (demo scheduled)
  (lead9, 'email_outbound', 'LinkedIn outreach',         'Connected on LinkedIn and sent intro message.', 'outbound', null, null, v_user_id, now() - interval '11 days'),
  (lead9, 'call',           'Discovery call',            'Asad wants a demo focused on multi-branch reporting. Scheduled for Thursday.', 'outbound', 25, 'Positive — follow up needed', v_user_id, now() - interval '8 days');

END $$;
