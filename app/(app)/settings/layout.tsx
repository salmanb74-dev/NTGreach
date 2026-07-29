import { isCrmAdmin, isCrmManager } from '@/lib/roles'
import { getCachedProfile } from '@/lib/dataCache'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SecondaryNav from '@/components/layout/SecondaryNav'
import type { SecondaryNavItem } from '@/components/layout/SecondaryNav'
import { getAccessibleModules } from '@/lib/roles'
import styles from './settings.module.css'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCachedProfile()
  if (!isCrmManager(profile)) redirect('/dashboard')

  const admin   = isCrmAdmin(profile)
  const manager = isCrmManager(profile)
  const modules = getAccessibleModules(profile)
  const activeModule = modules.find(m => m.startsWith('crm_')) ?? modules[0]

  const navItems: SecondaryNavItem[] = [
    ...(admin   ? [{ href: '/settings',                     label: 'General',             svgPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.071-3c0-.34-.027-.674-.08-1l2.116-1.65-2-3.464-2.49.998A7.002 7.002 0 0 0 14.5 5.8L14 3h-4l-.5 2.8a7.002 7.002 0 0 0-2.117 1.088L4.893 5.89l-2 3.464L4.99 11c-.053.326-.08.66-.08 1s.027.674.08 1L2.893 14.65l2 3.464 2.49-.998A7.002 7.002 0 0 0 9.5 18.2L10 21h4l.5-2.8a7.002 7.002 0 0 0 2.117-1.088l2.49.998 2-3.464L18.99 13c.053-.326.08-.66.08-1z' }] : []),
    ...(admin   ? [{ href: '/settings/users',               label: 'Users & Roles',       svgPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z m14 10v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' }] : []),
    ...(admin   ? [{ href: '/settings/enumerations',        label: 'Lists & Values',      svgPath: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4' }] : []),
    ...(manager ? [{ href: '/settings/targets',             label: 'Targets',             svgPath: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' }] : []),
    ...(manager ? [{ href: '/settings/contracts',           label: 'Contract Templates',  svgPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' }] : []),
    ...(manager ? [{ href: '/settings/quotation-templates', label: 'Quotation Templates', svgPath: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' }] : []),
  ]

  return (
    <>
      <Topbar
        title="Settings"
        modules={modules}
        activeModule={activeModule}
      />
      <div className={styles.layout}>
        <SecondaryNav title="Settings" items={navItems} />
        <div className={styles.content}>{children}</div>
      </div>
    </>
  )
}
