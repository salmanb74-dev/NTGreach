import LostReasonCard from '@/components/leads/LostReasonCard'
import DealPanel from '@/components/leads/DealPanel'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import LeadActions from '@/components/leads/LeadActions'
import Timeline from '@/components/leads/Timeline'
import Link from 'next/link'
import { getInputCurrency } from '@/lib/dataCache'
import styles from './lead.module.css'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [
    { data: lead },
    inputCurrency,
    { data: currencies },
  ] = await Promise.all([
    supabase.from('leads').select('*').eq('id', params.id).single(),
    getInputCurrency(),
    supabase.from('enumerations')
      .select('value, label')
      .eq('category', 'currency')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (!lead) notFound()

  const { data: activities } = await supabase
    .from('activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })

  // Derive counts from activities — no extra DB calls needed
  const meetingCount = (activities ?? []).filter(a => a.type.includes('meeting')).length
  const emailCount   = (activities ?? []).filter(a => a.type.includes('email')).length

  const initials = lead.contact_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <Topbar title={lead.contact_name} />
      <div className={styles.page}>

        <Link href="/leads" className={styles.back}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          All Leads
        </Link>

        <div className={styles.layout}>

          {/* ── Left sidebar ── */}
          <div className={styles.sidebar}>
            <div className={styles.profileCard}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.profileName}>{lead.contact_name}</div>
              <div className={styles.profileCompany}>{lead.company_name}</div>

              <div className={styles.contactList}>
                {lead.email && (
                  <div className={styles.contactRow}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className={styles.contactRow}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>{lead.phone}</span>
                  </div>
                )}
                {lead.city && (
                  <div className={styles.contactRow}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{lead.city}</span>
                  </div>
                )}
                {lead.restaurant_type && (
                  <div className={styles.contactRow}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                    </svg>
                    <span>{lead.restaurant_type}</span>
                  </div>
                )}
              </div>

              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <div className={styles.statNum}>{meetingCount ?? 0}</div>
                  <div className={styles.statLbl}>Meetings</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statNum}>{emailCount ?? 0}</div>
                  <div className={styles.statLbl}>Emails</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statNum}>{activities?.length ?? 0}</div>
                  <div className={styles.statLbl}>Activities</div>
                </div>
              </div>

              {/* All interactive actions — client component */}
              <LeadActions lead={lead} inputCurrency={inputCurrency} />

              <Link href={`/leads/${lead.id}/edit`} className={styles.editLink}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Lead
              </Link>
            </div>

            {/* Deal values panel */}
            <DealPanel
              leadId={lead.id}
              dealCurrency={lead.deal_currency}
              setupFee={lead.quoted_setup_fee}
              recurringFee={lead.quoted_mrr}
              frequency={lead.payment_frequency}
              discount={lead.discount ?? null}
              taxRate={lead.tax_rate ?? null}
              paymentStartDate={lead.payment_start_date}
              currencies={currencies ?? []}
              inputCurrency={inputCurrency}
            />

            <LostReasonCard stage={lead.stage} lostReason={lead.lost_reason} closedAt={lead.closed_at} />

            {lead.notes && (
              <div className={styles.notesCard}>
                <div className={styles.notesLabel}>Notes</div>
                <p className={styles.notesText}>{lead.notes}</p>
              </div>
            )}
          </div>

          {/* ── Timeline ── */}
          <div className={styles.main}>
            <Timeline activities={activities ?? []} />
          </div>

        </div>
      </div>
    </>
  )
}
