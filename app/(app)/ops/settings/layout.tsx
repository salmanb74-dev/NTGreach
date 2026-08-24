import { redirect } from 'next/navigation'
import { getCachedProfile } from '@/lib/dataCache'
import { isPlatformOpsAdmin } from '@/lib/roles'
import SecondaryNav from '@/components/layout/SecondaryNav'
import type { SecondaryNavItem } from '@/components/layout/SecondaryNav'
import styles from './settings.module.css'

export default async function OpsSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) redirect('/ops')

  const navItems: SecondaryNavItem[] = [
    {
      href: '/ops/settings/enumerations',
      label: 'Lists & Values',
      svgPath:
        'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4',
    },
  ]

  return (
    <div className={styles.layout}>
      <SecondaryNav title="Settings" items={navItems} />
      <div className={styles.content}>{children}</div>
    </div>
  )
}
