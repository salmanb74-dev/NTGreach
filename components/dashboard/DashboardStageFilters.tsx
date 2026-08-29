'use client'

import { PIPELINE_STAGES, STAGE_LABELS, STAGE_CSS, type PipelineStage } from '@/lib/types'
import styles from './dashboard.module.css'

interface Props {
  selectedStages: Set<PipelineStage>
  onToggle: (stage: PipelineStage) => void
  onSelectAll: () => void
  onClearAll: () => void
}

export default function DashboardStageFilters({
  selectedStages,
  onToggle,
  onSelectAll,
  onClearAll,
}: Props) {
  return (
    <div className={styles.stageFilters}>
      <div className={styles.stageFiltersHeader}>
        <span className={styles.stageFiltersLabel}>Pipeline stages</span>
        <div className={styles.stageFilterActions}>
          <button
            type="button"
            className={styles.stageFilterAction}
            onClick={onSelectAll}
          >
            Select all
          </button>
          <button
            type="button"
            className={styles.stageFilterAction}
            onClick={onClearAll}
          >
            Clear all
          </button>
        </div>
      </div>
      <div className={styles.stageFilterList}>
        {PIPELINE_STAGES.map(stage => {
          const cssKey = STAGE_CSS[stage]
          const checked = selectedStages.has(stage)
          return (
            <label
              key={stage}
              className={`${styles.stageFilterChip} ${checked ? styles.stageFilterChipOn : ''}`}
              style={{
                ['--chip-bg' as string]: `var(--stage-${cssKey}-bg)`,
                ['--chip-text' as string]: `var(--stage-${cssKey}-text)`,
                ['--chip-border' as string]: `var(--stage-${cssKey}-border)`,
              }}
            >
              <input
                type="checkbox"
                className={styles.stageFilterInput}
                checked={checked}
                onChange={() => onToggle(stage)}
              />
              {STAGE_LABELS[stage]}
            </label>
          )
        })}
      </div>
    </div>
  )
}
