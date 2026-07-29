import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import QuotationGenerator from '@/components/quotations/QuotationGenerator'
import Link from 'next/link'
import { prefillQuotationFromLead } from '@/lib/quotations'
import { getInputCurrency } from '@/lib/dataCache'
import styles from '@/app/(app)/contracts/new/contract.module.css'

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: { lead?: string }
}) {
  const supabase = createClient()

  const [
    { data: templates },
    inputCurrency,
  ] = await Promise.all([
    supabase.from('quotation_templates').select('id, name, is_default').order('created_at'),
    getInputCurrency(),
  ])

  let lead: any = null
  let prefilled: Record<string, string> = {}

  if (searchParams.lead) {
    const { data } = await supabase
      .from('leads')
      .select('id, contact_name, company_name, email, address, quoted_setup_fee, quoted_mrr, payment_frequency, deal_currency')
      .eq('id', searchParams.lead)
      .single()
    lead = data
    if (lead) prefilled = prefillQuotationFromLead(lead, inputCurrency)
  }

  if (!templates || templates.length === 0) {
    return (
      <>
        <Topbar title="New Quotation" />
        <div className={styles.page}>
          <p>No quotation templates found. Go to{' '}
            <Link href="/settings/quotation-templates" style={{ color: 'var(--color-primary)' }}>
              Settings → Quotation Templates
            </Link>{' '}
            to create one first, or run the Phase F migration.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="New Quotation" />
      <div className={styles.page}>
        <div className={styles.header}>
          {lead && (
            <Link href={`/leads/${lead.id}`} className={styles.back}>
              ← Back to {lead.company_name}
            </Link>
          )}
        </div>
        <QuotationGenerator
          templates={templates}
          lead={lead}
          prefilled={prefilled}
          inputCurrency={inputCurrency}
        />
      </div>
    </>
  )
}
