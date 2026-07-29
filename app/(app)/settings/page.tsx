import { createClient } from '@/lib/supabase/server'
import { updateAppSetting } from '@/lib/actions/settings'
import RefreshRatesButton from '@/components/settings/RefreshRatesButton'
import styles from './general.module.css'

export default async function SettingsGeneralPage() {
  const supabase = createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')

  const settingsMap: Record<string, string> = {}
  settings?.forEach(s => { settingsMap[s.key] = s.value })

  const inputCurrency = settingsMap['input_currency'] ?? 'PKR'
  const viewCurrencies = settingsMap['view_currencies'] ?? 'PKR'

  const { data: currencies } = await supabase
    .from('enumerations')
    .select('value, label')
    .eq('category', 'currency')
    .eq('is_active', true)
    .order('sort_order')

  async function saveInputCurrency(formData: FormData) {
    'use server'
    await updateAppSetting('input_currency', formData.get('input_currency') as string)
  }

  async function saveViewCurrencies(formData: FormData) {
    'use server'
    const vals = formData.getAll('view_currencies') as string[]
    // USD is always included regardless of selection
    const withUSD = Array.from(new Set(['USD', ...vals]))
    await updateAppSetting('view_currencies', withUSD.join(','))
  }

  const { data: latestRate } = await supabase
    .from('exchange_rates')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single()

  const lastUpdated = latestRate?.fetched_at
    ? new Date(latestRate.fetched_at).toLocaleString('en-PK', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Never'

  return (
    <div>
      <h2 className={styles.heading}>General Settings</h2>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Currency</div>
        <div className={styles.sectionDesc}>
          Input currency is used for all data entry. View currencies are available as display options on dashboards and reports.
        </div>

        <form action={saveInputCurrency} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Input Currency</label>
            <div className={styles.row}>
              <select name="input_currency" defaultValue={inputCurrency} className={styles.select}>
                {currencies?.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button type="submit" className={styles.saveBtn}>Save</button>
            </div>
          </div>
        </form>

        <form action={saveViewCurrencies} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>View Currencies (select all that apply)</label>
            <div className={styles.checkList}>
              {currencies?.map(c => (
                <label key={c.value} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    name="view_currencies"
                    value={c.value}
                    defaultChecked={viewCurrencies.includes(c.value) || c.value === 'USD'}
                    disabled={c.value === 'USD'}
                    className={styles.checkbox}
                  />
                  {c.label}
                  {c.value === 'USD' && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-3)', marginLeft: 4 }}>(always on)</span>
                  )}
                </label>
              ))}
            </div>
            <button type="submit" className={styles.saveBtn} style={{ marginTop: 10 }}>Save</button>
          </div>
        </form>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Exchange Rates</div>
        <div className={styles.sectionDesc}>
          Rates are fetched from frankfurter.app. Last updated: <strong>{lastUpdated}</strong>
        </div>
        <RefreshRatesButton />
      </div>
    </div>
  )
}
