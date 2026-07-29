'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import styles from '@/app/(app)/support/reports/reports.module.css'

interface Props {
  month: string
}

export default function SupportReportsClient({ month }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1 + delta, 1))
    const next = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', next)
    router.push(`/support/reports?${params.toString()}`)
  }

  return (
    <div className={styles.monthNav}>
      <button type="button" className={styles.monthBtn} onClick={() => shiftMonth(-1)}>
        ←
      </button>
      <input
        type="month"
        className={styles.monthInput}
        value={month}
        onChange={e => {
          if (!e.target.value) return
          const params = new URLSearchParams(searchParams.toString())
          params.set('month', e.target.value)
          router.push(`/support/reports?${params.toString()}`)
        }}
        aria-label="Select month"
      />
      <button type="button" className={styles.monthBtn} onClick={() => shiftMonth(1)}>
        →
      </button>
    </div>
  )
}
