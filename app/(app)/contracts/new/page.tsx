import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import ContractGenerator from '@/components/contracts/ContractGenerator'
import Link from 'next/link'
import { prefillFromLead } from '@/lib/contracts'
import styles from './contract.module.css'

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: { lead?: string }
}) {
  const supabase = createClient()

  const { data: templates } = await supabase
    .from('contract_templates')
    .select('id, name, is_default')
    .order('created_at')

  const { data: currencySetting } = await supabase
    .from('app_settings').select('value').eq('key', 'input_currency').single()
  const inputCurrency = currencySetting?.value ?? 'PKR'

  let lead: any = null
  let prefilled: Record<string, string> = {}

  if (searchParams.lead) {
    const { data } = await supabase
      .from('leads')
      .select('id, contact_name, company_name, email, address, quoted_setup_fee, quoted_mrr, payment_frequency, deal_currency')
      .eq('id', searchParams.lead)
      .single()
    lead = data
    if (lead) prefilled = prefillFromLead(lead, inputCurrency)
  }

  if (!templates || templates.length === 0) {
    return (
      <>
        <Topbar title="New Contract" />
        <div style={{ padding: 32 }}>
          <p>No contract templates found. Go to <Link href="/settings/contracts" style={{ color: 'var(--color-primary)' }}>Settings → Contract Templates</Link> to create one first.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="New Contract" />
      <div className={styles.page}>
        <div className={styles.header}>
          {lead && (
            <Link href={`/leads/${lead.id}`} className={styles.back}>
              ← Back to {lead.company_name}
            </Link>
          )}
        </div>
        <ContractGenerator
          templates={templates}
          lead={lead}
          prefilled={prefilled}
          inputCurrency={inputCurrency}
        />
      </div>
    </>
  )
}
