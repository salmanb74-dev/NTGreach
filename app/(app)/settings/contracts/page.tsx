import { createClient } from '@/lib/supabase/server'
import ContractTemplatesClient from '@/components/contracts/ContractTemplatesClient'
import { getDealQuoteDefaults } from '@/lib/dataCache'
import { CONTRACT_VARIABLES } from '@/lib/contracts'
import { previewVariablesFromDealDefaults } from '@/lib/template-print'
import styles from '../general.module.css'

export default async function ContractTemplatesPage() {
  const supabase = createClient()
  const [{ data: templates }, dealDefaults] = await Promise.all([
    supabase
      .from('contract_templates')
      .select('id, name, is_default, updated_at')
      .order('created_at'),
    getDealQuoteDefaults(),
  ])

  const previewVars = previewVariablesFromDealDefaults(
    CONTRACT_VARIABLES,
    dealDefaults,
    'contract'
  )

  return (
    <div>
      <h2 className={styles.heading}>Contract Templates</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24, lineHeight: 1.5 }}>
        Create and edit contract templates. Use <code style={{ background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{'{{variable}}'}</code> placeholders — they get filled in when generating a contract for a lead. PDF preview uses Settings → Default deal values.
      </p>
      <ContractTemplatesClient
        templates={templates ?? []}
        previewVars={previewVars}
      />
    </div>
  )
}
