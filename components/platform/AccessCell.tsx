'use client'

import { accessSegmentsForProfile } from '@/lib/platform/access-model'
import type { UserRole } from '@/lib/roles'
import styles from './Users.module.css'

/** Access column: bold module name, normal weight roles in parentheses. */
export default function AccessCell({
  roles,
  products,
}: {
  roles: UserRole[]
  products: string[]
}) {
  const segments = accessSegmentsForProfile(roles, products)
  if (!segments.length) {
    return <span className={styles.muted}>—</span>
  }

  return (
    <span className={styles.accessCellText}>
      {segments.map((s, i) => (
        <span key={s.module}>
          {i > 0 ? ', ' : null}
          <strong className={styles.accessModule}>{s.moduleLabel}</strong>
          {s.rolesLabel ? (
            <span className={styles.accessRoles}> ({s.rolesLabel})</span>
          ) : null}
        </span>
      ))}
    </span>
  )
}
