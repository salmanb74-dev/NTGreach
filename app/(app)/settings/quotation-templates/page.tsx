import { createClient } from '@/lib/supabase/server'
import QuotationTemplatesClient from '@/components/quotations/QuotationTemplatesClient'
import { getDealQuoteDefaults } from '@/lib/dataCache'
import { getEnumerations } from '@/lib/enumerations'
import { currencyLabelsFromOptions } from '@/lib/currency-display'
import { QUOTATION_VARIABLES } from '@/lib/quotations'
import { previewVariablesFromDealDefaults } from '@/lib/template-print'
import styles from '../general.module.css'

export default async function QuotationTemplatesPage() {
  const supabase = createClient()
  const [{ data: templates }, dealDefaults, currencyOptions] = await Promise.all([
    supabase
      .from('quotation_templates')
      .select('id, name, is_default, updated_at')
      .order('created_at'),
    getDealQuoteDefaults(),
    getEnumerations('currency'),
  ])

  const previewVars = previewVariablesFromDealDefaults(
    QUOTATION_VARIABLES,
    dealDefaults,
    'quotation',
    currencyLabelsFromOptions(currencyOptions)
  )

  return (
    <div>
      <h2 className={styles.heading}>Quotation Templates</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24, lineHeight: 1.5 }}>
        Create and edit quotation templates. Use{' '}
        <code style={{ background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>
          {'{{variable}}'}
        </code>{' '}
        placeholders — they get filled when generating a quotation for a lead. PDF preview uses Settings → Default deal values.
      </p>
      <QuotationTemplatesClient
        templates={templates ?? []}
        previewVars={previewVars}
      />
    </div>
  )
}
