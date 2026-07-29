'use client'

import styles from './charts.module.css'

interface FunnelData {
  stage: string
  count: number
  cssKey: string
}

export default function FunnelChart({ data }: { data: FunnelData[] }) {
  const max = Math.max(...data.map(d => d.count), 1)

  if (data.every(d => d.count === 0)) {
    return <div className={styles.empty}>No leads yet</div>
  }

  return (
    <div className={styles.funnel}>
      {data.map(({ stage, count, cssKey }) => {
        const pct = Math.round((count / max) * 100)
        return (
          <div key={stage} className={styles.funnelRow}>
            <div className={styles.funnelLabel}>{stage}</div>
            <div className={styles.funnelBarWrap}>
              <div
                className={styles.funnelBar}
                style={{
                  width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                  background: `var(--stage-${cssKey}-bar)`,
                }}
              />
            </div>
            <div className={styles.funnelCount}>{count}</div>
          </div>
        )
      })}
    </div>
  )
}
