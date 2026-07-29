import { STAGE_LABELS, STAGE_CSS, type PipelineStage } from '@/lib/types'
import styles from './charts.module.css'

interface ConversionStatsProps {
  stages: PipelineStage[]
  counts: Record<string, number>
  total: number
}

export default function ConversionStats({ stages, counts, total }: ConversionStatsProps) {
  if (total === 0) {
    return <div className={styles.empty}>No leads yet</div>
  }

  return (
    <div className={styles.conversionList}>
      {stages.map(stage => {
        const count  = counts[stage] ?? 0
        const pct    = total > 0 ? Math.round((count / total) * 100) : 0
        const cssKey = STAGE_CSS[stage]
        return (
          <div key={stage} className={styles.convRow}>
            <div className={styles.convMeta}>
              <span
                className={styles.convBadge}
                style={{
                  background: `var(--stage-${cssKey}-bg)`,
                  color:      `var(--stage-${cssKey}-text)`,
                  borderColor:`var(--stage-${cssKey}-border)`,
                }}
              >
                {STAGE_LABELS[stage]}
              </span>
              <span className={styles.convCount}>{count}</span>
              <span className={styles.convPct}>{pct}%</span>
            </div>
            <div className={styles.convBarWrap}>
              <div
                className={styles.convBar}
                style={{
                  width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                  background: `var(--stage-${cssKey}-bar)`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
