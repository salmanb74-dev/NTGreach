import Topbar from '@/components/layout/Topbar'
import styles from '../leads/placeholder.module.css'
export default function CalendarPage() {
  return (<><Topbar title="Calendar" /><div className={styles.page}><div className={styles.coming}><div className={styles.icon}>📅</div><div className={styles.label}>Calendar Sync — Coming in Phase 5</div></div></div></>)
}
