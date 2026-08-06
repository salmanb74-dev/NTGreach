'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DEFAULT_TEMP_PASSWORD,
  resetReachUserPassword,
  updateReachUser,
} from '@/lib/actions/platform-users'
import {
  EDITABLE_ROLES,
  PRODUCT_LABELS,
  ROLE_LABELS,
  type Product,
  type UserRole,
} from '@/lib/roles'
import type { PlatformUserRow } from '@/components/platform/types'
import styles from './Users.module.css'

interface Props {
  user: PlatformUserRow
  canEdit: boolean
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UserDetailClient({ user, canEdit }: Props) {
  const router = useRouter()
  const [name, setName] = useState(user.full_name ?? '')
  const [roles, setRoles] = useState<UserRole[]>(user.roles)
  const [products, setProducts] = useState<Product[]>(user.products)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggleRole(role: UserRole) {
    if (!canEdit) return
    setRoles(prev => {
      let next = prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
      if (role === 'ops_admin' && next.includes('ops_admin')) {
        next = next.filter(r => r !== 'ops_user')
      }
      if (role === 'ops_user' && next.includes('ops_user')) {
        next = next.filter(r => r !== 'ops_admin')
      }
      return next
    })
  }

  function toggleProduct(product: Product) {
    if (!canEdit) return
    setProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    )
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateReachUser(user.id, {
          fullName: name,
          roles,
          products,
        })
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  function handleResetPassword() {
    if (!canEdit) return
    if (
      !window.confirm(
        `Reset password for ${user.email} to temporary password ${DEFAULT_TEMP_PASSWORD}?`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await resetReachUserPassword(user.id)
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reset password')
      }
    })
  }

  const groups = Array.from(new Set(EDITABLE_ROLES.map(r => r.group)))

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/platform/users" className={styles.backLink}>
          ← All users
        </Link>
        {!canEdit && <span className={styles.viewOnlyBadge}>View only</span>}
      </div>

      <div className={styles.titleBlock}>
        <h2 className={styles.title}>{user.full_name || user.email}</h2>
        <p className={styles.sub}>{user.email}</p>
      </div>

      <form className={styles.detailForm} onSubmit={handleSave}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Full name</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!canEdit}
            required
          />
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <input className={styles.input} value={user.email} disabled readOnly />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Password last changed</span>
          <div className={styles.staticValue}>
            {formatWhen(user.password_changed_at)}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Products</span>
          <div className={styles.checks}>
            {(['resto', 'alma'] as Product[]).map(p => (
              <label key={p} className={styles.check}>
                <input
                  type="checkbox"
                  checked={products.includes(p)}
                  onChange={() => toggleProduct(p)}
                  disabled={!canEdit}
                />
                {PRODUCT_LABELS[p]}
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            Products combine with CRM / Support / Ops Admin roles to unlock
            modules (e.g. CRM Resto, Ops Resto).
          </p>
        </div>

        {groups.map(group => (
          <div key={group} className={styles.field}>
            <span className={styles.fieldLabel}>
              {group === 'Ops' ? 'Ops module' : `${group} roles`}
            </span>
            <div className={styles.checks}>
              {EDITABLE_ROLES.filter(r => r.group === group).map(r => (
                <label key={r.value} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={roles.includes(r.value)}
                    onChange={() => toggleRole(r.value)}
                    disabled={!canEdit}
                  />
                  {r.label}
                  {group === 'Ops' && r.value === 'ops_admin' && (
                    <span className={styles.hintInline}> — can edit users</span>
                  )}
                  {group === 'Ops' && r.value === 'ops_user' && (
                    <span className={styles.hintInline}> — view-only</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Current roles</span>
          <div className={styles.badges}>
            {roles.length === 0 ? (
              <span className={styles.muted}>—</span>
            ) : (
              roles.map(r => (
                <span key={r} className={styles.badge}>
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))
            )}
          </div>
        </div>

        {error && <p className={styles.formError}>{error}</p>}
        {saved && !error && (
          <p className={styles.savedMsg}>Saved</p>
        )}

        {canEdit && (
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleResetPassword}
              disabled={isPending}
            >
              Reset password to temp
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
