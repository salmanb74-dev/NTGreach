'use client'

import { useState, useTransition } from 'react'
import { updateUserRoles } from '@/lib/actions/settings'
import type { UserRole } from '@/lib/roles'
import styles from './UsersRoles.module.css'

export const ALL_ROLES = [
  { value: 'crm_admin',      label: 'CRM Admin',     group: 'CRM' },
  { value: 'crm_manager',    label: 'CRM Manager',   group: 'CRM' },
  { value: 'crm_sales_rep',  label: 'Sales Rep',     group: 'CRM' },
  { value: 'cs_admin',       label: 'CS Admin',      group: 'Support' },
  { value: 'cs_manager',     label: 'CS Manager',    group: 'Support' },
  { value: 'cs_support_rep', label: 'Support Rep',   group: 'Support' },
  { value: 'admin_resto',    label: 'Resto Admin',   group: 'Admin' },
  { value: 'admin_alma',     label: 'Alma Admin',    group: 'Admin' },
]

export const ROLE_LABELS: Record<string, string> = {
  crm_admin:      'CRM Admin',
  crm_manager:    'CRM Manager',
  crm_sales_rep:  'Sales Rep',
  cs_admin:       'CS Admin',
  cs_manager:     'CS Manager',
  cs_support_rep: 'Support Rep',
  admin_resto:    'Resto Admin',
  admin_alma:     'Alma Admin',
}

interface User {
  id: string
  full_name: string | null
  email: string
  roles: UserRole[]
}

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return email[0].toUpperCase()
}

export default function UsersRolesClient({ users }: { users: User[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [roleMap, setRoleMap] = useState<Record<string, UserRole[]>>(
    Object.fromEntries(users.map(u => [u.id, u.roles ?? ['crm_sales_rep']]))
  )
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)

  function toggleRole(userId: string, role: UserRole) {
    setRoleMap(prev => {
      const current = prev[userId] ?? []
      const next = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role]
      return { ...prev, [userId]: next.length === 0 ? ['crm_sales_rep'] : next }
    })
  }

  function handleSave(userId: string) {
    startTransition(async () => {
      await updateUserRoles(userId, roleMap[userId])
      setSaved(userId)
      setEditing(null)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  return (
    <div className={styles.list}>
      {users.map(user => {
        const isEditing = editing === user.id
        const roles = roleMap[user.id] ?? ['crm_sales_rep']

        return (
          <div key={user.id} className={styles.userCard}>
            <div className={styles.userLeft}>
              <div className={styles.avatar}>{initials(user.full_name, user.email)}</div>
              <div>
                <div className={styles.userName}>{user.full_name ?? '—'}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </div>
            </div>

            <div className={styles.userRight}>
              {!isEditing ? (
                <>
                  <div className={styles.roleBadges}>
                    {roles.map(r => (
                      <span key={r} className={styles.roleBadge}>{ROLE_LABELS[r]}</span>
                    ))}
                  </div>
                  {saved === user.id && (
                    <span className={styles.savedMsg}>✓ Saved</span>
                  )}
                  <button className={styles.editBtn} onClick={() => setEditing(user.id)}>
                    Edit roles
                  </button>
                </>
              ) : (
                <div className={styles.roleEditor}>
                  {ALL_ROLES.map(role => (
                    <label key={role.value as string} className={styles.roleCheck}>
                      <input
                        type="checkbox"
                        checked={roles.includes(role.value as UserRole)}
                        onChange={() => toggleRole(user.id, role.value as UserRole)}
                        className={styles.checkbox}
                      />
                      {ROLE_LABELS[role.value]}
                    </label>
                  ))}
                  <div className={styles.editorBtns}>
                    <button className={styles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
                    <button className={styles.saveBtn} onClick={() => handleSave(user.id)} disabled={isPending}>
                      {isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
