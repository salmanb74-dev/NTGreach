'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import styles from './CurrencySwitcher.module.css'

interface Props {
  viewCurrencies: string[]
  selected:       string
  rates:          { base: string; target: string; rate: number; fetched_at: string }[]
}

export default function CurrencySwitcher({ viewCurrencies, selected, rates }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(currency: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('currency', currency)
    router.push(`?${params.toString()}`)
  }

  // Show when last updated
  const lastRate = rates[0]
  const lastUpdated = lastRate
    ? new Date(lastRate.fetched_at).toLocaleString('en-PK', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    : null

  if (viewCurrencies.length <= 1) return null

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>View in:</span>
      <div className={styles.pills}>
        {viewCurrencies.map(c => (
          <button
            key={c}
            className={`${styles.pill} ${selected === c ? styles.active : ''}`}
            onClick={() => handleChange(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {lastUpdated && (
        <span className={styles.updated}>Rates updated {lastUpdated}</span>
      )}
    </div>
  )
}
