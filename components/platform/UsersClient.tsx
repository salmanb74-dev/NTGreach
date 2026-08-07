'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createReachUser } from '@/lib/actions/platform-users'
import ModuleRoleMatrix from '@/components/platform/ModuleRoleMatrix'
import AccessCell from '@/components/platform/AccessCell'
import { DEFAULT_TEMP_PASSWORD } from '@/lib/platform/constants'
import {
  defaultModuleRoleMap,
  formatAccessByModule,
  type ModuleRoleMap,
} from '@/lib/platform/access-model'
import type { PlatformUserRow } from '@/components/platform/types'
import { formatWhen } from '@/lib/format-when'
import styles from './Users.module.css'

interface Props {
  initialUsers: PlatformUserRow[]
  canEdit: boolean
  loadError?: string | null
}

export default function UsersClient({
  initialUsers,
  canEdit,
  loadError = null,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [moduleRoles, setModuleRoles] = useState<ModuleRoleMap>(() =>
    defaultModuleRoleMap()
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialUsers
    return initialUsers.filter(u => {
      const hay = [
        u.full_name ?? '',
        u.email,
        formatAccessByModule(u.roles, u.products),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [initialUsers, query])

  function openAdd() {
    setError(null)
    setName('')
    setEmail('')
    setModuleRoles(defaultModuleRoleMap())
    setShowAdd(true)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const { id } = await createReachUser({
          fullName: name,
          email,
          moduleRoles,
        })
        setShowAdd(false)
        router.push('/ops/users')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create user')
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Reach users</h2>
          <p className={styles.sub}>
            Agents across CRM, Support, and Ops. Temporary password for new
            accounts and resets:{' '}
            <code className={styles.code}>{DEFAULT_TEMP_PASSWORD}</code>
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, access…"
            aria-label="Search users"
          />
          {canEdit && (
            <button type="button" className={styles.primaryBtn} onClick={openAdd}>
              Add user
            </button>
          )}
        </div>
      </div>

      <div className={styles.metaRow}>
        Showing{' '}
        <span className={styles.metaStrong}>{filtered.length}</span>
        {query.trim() ? ` of ${initialUsers.length}` : ''} user
        {filtered.length === 1 ? '' : 's'}
        {!canEdit && (
          <span className={styles.viewOnly}> · View only</span>
        )}
      </div>

      {loadError && (
        <div className={styles.formError} role="alert">
          Could not load users: {loadError}
        </div>
      )}

      {filtered.length === 0 && !loadError ? (
        <div className={styles.empty}>
          {query.trim()
            ? 'No users match your search.'
            : 'No profiles returned. Confirm profiles exist in Supabase and SUPABASE_SERVICE_ROLE_KEY is set if RLS blocks reads.'}
        </div>
      ) : filtered.length === 0 && loadError ? (
        <div className={styles.empty}>Fix the load error above, then refresh.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
                <th>Created</th>
                <th>Modified</th>
                <th>Password changed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr
                  key={user.id}
                  className={styles.rowLink}
                  onClick={() => router.push(`/ops/users/${user.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/ops/users/${user.id}`)
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${user.full_name || user.email}`}
                >
                  <td className={styles.nameCell}>{user.full_name || '—'}</td>
                  <td>{user.email}</td>
                  <td className={styles.accessCell}>
                    <AccessCell roles={user.roles} products={user.products} />
                  </td>
                  <td className={styles.muted}>
                    {formatWhen(user.created_at)}
                  </td>
                  <td className={styles.muted}>
                    {formatWhen(user.updated_at)}
                  </td>
                  <td className={styles.muted}>
                    {formatWhen(user.password_changed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setShowAdd(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-labelledby="add-user-title"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="add-user-title" className={styles.modalTitle}>
              Add user
            </h3>
            <p className={styles.modalSub}>
              Creates a Reach login with temporary password{' '}
              <code className={styles.code}>{DEFAULT_TEMP_PASSWORD}</code>. They
              should change it after first sign-in.
            </p>
            <form className={styles.form} onSubmit={handleCreate}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Full name</span>
                <input
                  className={styles.input}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Module access</span>
                <ModuleRoleMatrix
                  value={moduleRoles}
                  onChange={setModuleRoles}
                />
              </div>

              {error && <p className={styles.formError}>{error}</p>}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowAdd(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isPending}
                >
                  {isPending ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
