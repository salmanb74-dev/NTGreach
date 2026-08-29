'use client'

import { STAGE_LABELS, STAGE_CSS, type PipelineStage } from '@/lib/types'
import styles from './charts.module.css'

export type PipelineStageRow = {
  stage: PipelineStage
  count: number
}

export default function PipelineStageTable({ rows }: { rows: PipelineStageRow[] }) {
  if (rows.length === 0) {
    return <div className={styles.empty}>No stages selected</div>
  }

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  if (total === 0 && rows.every(r => r.count === 0)) {
    return <div className={styles.empty}>No leads yet</div>
  }

  return (
    <table className={styles.pipelineTable}>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Leads</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ stage, count }) => {
          const cssKey = STAGE_CSS[stage]
          return (
            <tr key={stage}>
              <td>
                <span
                  className={styles.pipelineStageBadge}
                  style={{
                    background: `var(--stage-${cssKey}-bg)`,
                    color: `var(--stage-${cssKey}-text)`,
                    borderColor: `var(--stage-${cssKey}-border)`,
                  }}
                >
                  {STAGE_LABELS[stage]}
                </span>
              </td>
              <td className={styles.pipelineCount}>{count}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
