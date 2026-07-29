import styles from './dashboard.module.css'
import skeletonStyles from '@/styles/skeleton.module.css'

export default function DashboardLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.statsRow}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`${styles.statCard} ${skeletonStyles.card}`}>
            <div className={skeletonStyles.line} style={{ width: '60%', height: 12 }} />
            <div className={skeletonStyles.line} style={{ width: '40%', height: 28, marginTop: 8 }} />
            <div className={skeletonStyles.line} style={{ width: '50%', height: 10, marginTop: 6 }} />
          </div>
        ))}
      </div>
      <div className={styles.row}>
        <div className={`${styles.chartCard} ${styles.chartFlex1} ${skeletonStyles.card}`} style={{ height: 220 }} />
        <div className={`${styles.chartCard} ${styles.chartFlex14} ${skeletonStyles.card}`} style={{ height: 220 }} />
      </div>
    </div>
  )
}
