import skeletonStyles from '@/styles/skeleton.module.css'
import styles from './leads.module.css'

export default function LeadsLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={`${skeletonStyles.block}`} style={{ width: 200, height: 36 }} />
        <div className={`${skeletonStyles.block}`} style={{ width: 100, height: 36 }} />
      </div>
      <div className={skeletonStyles.card}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className={skeletonStyles.block} style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className={skeletonStyles.line} style={{ width: '40%', height: 12 }} />
              <div className={skeletonStyles.line} style={{ width: '25%', height: 10, marginTop: 5 }} />
            </div>
            <div className={skeletonStyles.block} style={{ width: 80, height: 22, borderRadius: 99 }} />
            <div className={skeletonStyles.line} style={{ width: 60, height: 12, alignSelf: 'center' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
