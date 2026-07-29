import styles from './LostReasonCard.module.css'

interface Props {
  stage:       string
  lostReason:  string | null
  closedAt:    string | null
}

export default function LostReasonCard({ stage, lostReason, closedAt }: Props) {
  if (stage !== 'closed_lost' && stage !== 'disqualified') return null
  if (!lostReason) return null

  const isDisqualified = stage === 'disqualified'

  return (
    <div className={`${styles.card} ${isDisqualified ? styles.disqualified : styles.lost}`}>
      <div className={styles.header}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span className={styles.title}>
          {isDisqualified ? 'Disqualified' : 'Closed Lost'}
        </span>
        {closedAt && (
          <span className={styles.date}>
            {new Date(closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <p className={styles.reason}>{lostReason}</p>
    </div>
  )
}
