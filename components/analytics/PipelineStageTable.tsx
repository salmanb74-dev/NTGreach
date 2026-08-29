'use client'

import StageBadge from '@/components/ui/StageBadge'
import type { PipelineStage } from '@/lib/types'
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
        {rows.map(({ stage, count }) => (
          <tr key={stage}>
            <td>
              <StageBadge stage={stage} size="sm" />
            </td>
            <td className={styles.pipelineCount}>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
