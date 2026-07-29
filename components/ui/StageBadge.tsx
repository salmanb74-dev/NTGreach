import { STAGE_CSS, STAGE_LABELS, type PipelineStage } from '@/lib/types'
import styles from './StageBadge.module.css'

interface StageBadgeProps {
  stage: PipelineStage
  size?: 'sm' | 'md'
}

export default function StageBadge({ stage, size = 'md' }: StageBadgeProps) {
  const css = STAGE_CSS[stage]
  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{
        background: `var(--stage-${css}-bg)`,
        color: `var(--stage-${css}-text)`,
        borderColor: `var(--stage-${css}-border)`,
      }}
    >
      {STAGE_LABELS[stage]}
    </span>
  )
}
