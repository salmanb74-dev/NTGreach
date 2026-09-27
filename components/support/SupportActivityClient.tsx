'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SupportActivityFeed from '@/components/support/SupportActivityFeed'
import type { SupportActivityRow } from '@/components/support/types'
import styles from '@/app/(app)/support/activity/activity.module.css'

export type ActivityRange = '1d' | '7d' | '30d' | 'all'

const RANGE_OPTIONS: { value: ActivityRange; label: string }[] = [
  { value: '1d',  label: '24h' },
  { value: '7d',  label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
]

interface Props {
  rows:      SupportActivityRow[]
  range:     ActivityRange
  basePath?: string
}

export default function SupportActivityClient({
  rows,
  range,
  basePath = '/support/activity',
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customerQuery, setCustomerQuery] = useState('')

  const filteredRows = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.tenantName.toLowerCase().includes(q))
  }, [rows, customerQuery])

  const totalSent     = filteredRows.reduce((sum, r) => sum + r.sent.total, 0)
  const totalReceived = filteredRows.reduce((sum, r) => sum + r.received.total, 0)
  const customerCount = new Set(filteredRows.map(r => r.tenantId)).size

  function setRange(next: ActivityRange) {
    if (next === range) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', next)
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <>
      <div className={styles.filtersBar}>
        <div className={styles.pills} role="radiogroup" aria-label="Date range">
          {RANGE_OPTIONS.map(opt => {
            const selected = range === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.pill} ${selected ? styles.pillActive : ''}`}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <input
          type="search"
          className={styles.filtersInput}
          value={customerQuery}
          onChange={e => setCustomerQuery(e.target.value)}
          placeholder="Filter by customer…"
          aria-label="Filter by customer"
        />
      </div>

      {filteredRows.length > 0 && (
        <div className={styles.summary}>
          <span>
            <span className={styles.summaryStrong}>{totalSent}</span> sent by rep
          </span>
          <span>
            <span className={styles.summaryStrong}>{totalReceived}</span> from customers
          </span>
          <span>
            <span className={styles.summaryStrong}>{customerCount}</span>{' '}
            {customerCount === 1 ? 'customer' : 'customers'}
          </span>
        </div>
      )}

      <SupportActivityFeed rows={filteredRows} />
    </>
  )
}
