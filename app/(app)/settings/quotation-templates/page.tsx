import { createClient } from '@/lib/supabase/server'
import QuotationTemplatesClient from '@/components/quotations/QuotationTemplatesClient'
import styles from '../general.module.css'

export default async function QuotationTemplatesPage() {
  const supabase = createClient()
  const { data: templates } = await supabase
    .from('quotation_templates')
    .select('id, name, is_default, updated_at')
    .order('created_at')

  return (
    <div>
      <h2 className={styles.heading}>Quotation Templates</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 24, lineHeight: 1.5 }}>
        Create and edit quotation templates. Use{' '}
        <code style={{ background: 'var(--color-surface-2)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>
          {'{{variable}}'}
        </code>{' '}
        placeholders — they get filled when generating a quotation for a lead.
      </p>
      <QuotationTemplatesClient templates={templates ?? []} />
    </div>
  )
}
