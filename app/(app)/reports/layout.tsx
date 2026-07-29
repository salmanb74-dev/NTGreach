import SecondaryNav from '@/components/layout/SecondaryNav'
import type { SecondaryNavItem } from '@/components/layout/SecondaryNav'
import styles from './reports-layout.module.css'

const NAV_ITEMS: SecondaryNavItem[] = [
  { href: '/reports', label: 'Performance', icon: '📊' },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <SecondaryNav title="Reports" items={NAV_ITEMS} />
      <div className={styles.content}>{children}</div>
    </div>
  )
}
