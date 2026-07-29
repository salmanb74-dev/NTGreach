import styles from './reports.module.css'
import skeletonStyles from '@/styles/skeleton.module.css'

export default function ReportsLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={`${skeletonStyles.block}`} style={{ width: 200, height: 36 }} />
        <div className={`${skeletonStyles.block}`} style={{ width: 160, height: 36 }} />
      </div>
      <div className={`${skeletonStyles.card}`} style={{ padding: 20 }}>
        <div className={skeletonStyles.line} style={{ width: '30%', height: 14 }} />
        <div className={skeletonStyles.line} style={{ width: '50%', height: 10, marginTop: 6 }} />
        <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div className={skeletonStyles.line} style={{ height: 10, marginBottom: 6 }} />
              <div className={skeletonStyles.block} style={{ height: 8, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
