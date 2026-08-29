import styles from '@/components/dashboard/dashboard.module.css'
import skeletonStyles from '@/styles/skeleton.module.css'

export default function DashboardLoading() {
  return (
    <div className={styles.page}>
      <div
        className={`${styles.stageFilters} ${skeletonStyles.card}`}
        style={{ height: 72 }}
      />
      <div className={styles.statsRow}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`${styles.statCard} ${skeletonStyles.card}`}>
            <div className={skeletonStyles.line} style={{ width: '60%', height: 12 }} />
            <div
              className={skeletonStyles.line}
              style={{ width: '40%', height: 28, marginTop: 8 }}
            />
            <div
              className={skeletonStyles.line}
              style={{ width: '50%', height: 10, marginTop: 6 }}
            />
          </div>
        ))}
      </div>
      <div className={styles.chartsGrid}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`${styles.chartCard} ${skeletonStyles.card}`}
            style={{ minHeight: 400 }}
          />
        ))}
      </div>
    </div>
  )
}
