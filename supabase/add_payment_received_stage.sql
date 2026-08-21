-- Add pipeline stage: payment_received ("Paid") — after closed_won.
-- Also ensure early_exit is allowed if missing from the live check constraint.
-- Safe to re-run. Does not move any existing leads.

alter table public.leads
  drop constraint if exists leads_stage_check;

alter table public.leads
  add constraint leads_stage_check
  check (stage in (
    'new',
    'contacted',
    'demo_scheduled',
    'proposal_sent',
    'negotiation',
    'closed_won',
    'payment_received',
    'closed_lost',
    'early_exit'
  ));
