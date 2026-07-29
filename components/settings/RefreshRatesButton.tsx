'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './RefreshRates.module.css'

export default function RefreshRatesButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleRefresh() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/exchange-rates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.source === 'previous_day') {
        setMsg(`Copied rates from ${data.fromDate} (live API unavailable)`)
      } else {
        setMsg(`Rates updated for ${data.date} — ${data.pairs} pairs`)
      }
      router.refresh()
    } catch (err: any) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={handleRefresh} disabled={loading}>
        {loading ? (
          <>
            <svg className={styles.spin} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Fetching rates…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
            Refresh Exchange Rates
          </>
        )}
      </button>
      {msg && (
        <span className={`${styles.msg} ${msg.startsWith('Error') ? styles.error : styles.success}`}>
          {msg}
        </span>
      )}
    </div>
  )
}
