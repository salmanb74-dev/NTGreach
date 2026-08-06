'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createReachUser,
  DEFAULT_TEMP_PASSWORD,
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
  initialUsers: PlatformUserRow[]
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

function modulesSummary(roles: UserRole[], products: Product[]): string {
  const bits: string[] = []
  const hasCrm = roles.some(r => r.startsWith('crm_'))
  const hasCs = roles.some(r => r.startsWith('cs_'))
  const hasOpsAdmin = roles.includes('ops_admin')
  const hasOpsUser = roles.includes('ops_user')

  for (const p of products) {
    if (hasCrm) bits.push(`CRM ${PRODUCT_LABELS[p]}`)
    if (hasCs) bits.push(`Support ${PRODUCT_LABELS[p]}`)
    if (hasOpsAdmin) bits.push(`Ops ${PRODUCT_LABELS[p]}`)
  }
  if (hasOpsAdmin) bits.push('Ops (Admin)')
  else if (hasOpsUser) bits.push('Ops (User)')

  return bits.length ? bits.join(', ') : '—'
}

export default function UsersClient({ initialUsers, canEdit }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<UserRole[]>(['crm_sales_rep'])
  const [products, setProducts] = useState<Product[]>(['resto'])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialUsers
    return initialUsers.filter(u => {
      const hay = [
        u.full_name ?? '',
        u.email,
        ...(u.roles ?? []).map(r => ROLE_LABELS[r] ?? r),
        ...(u.products ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [initialUsers, query])

  function toggleRole(role: UserRole) {
    setRoles(prev => {
      let next = prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
      // Exclusive platform Ops role
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
    setProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    )
  }

  function openAdd() {
    setError(null)
    setName('')
    setEmail('')
    setRoles(['crm_sales_rep'])
    setProducts(['resto'])
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
          roles,
          products,
        })
        setShowAdd(false)
        router.push(`/platform/users/${id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create user')
      }
    })
  }

  const groups = Array.from(new Set(EDITABLE_ROLES.map(r => r.group)))

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Reach users</h2>
          <p className={styles.sub}>
            Agents across CRM, Support, and Ops. Temporary password for new
            accounts: <code className={styles.code}>{DEFAULT_TEMP_PASSWORD}</code>
          </p>
        </div>
        <div className={styles.controls}>
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, role…"
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

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {query.trim() ? 'No users match your search.' : 'No users found.'}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
                <th>Password changed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr
                  key={user.id}
                  className={styles.rowLink}
                  onClick={() => router.push(`/platform/users/${user.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/platform/users/${user.id}`)
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${user.full_name || user.email}`}
                >
                  <td className={styles.nameCell}>{user.full_name || '—'}</td>
                  <td>{user.email}</td>
                  <td className={styles.accessCell}>
                    {modulesSummary(user.roles, user.products)}
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
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowAdd(false)}>
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
                <span className={styles.fieldLabel}>Products</span>
                <div className={styles.checks}>
                  {(['resto', 'alma'] as Product[]).map(p => (
                    <label key={p} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={products.includes(p)}
                        onChange={() => toggleProduct(p)}
                      />
                      {PRODUCT_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>

              {groups.map(group => (
                <div key={group} className={styles.field}>
                  <span className={styles.fieldLabel}>{group} roles</span>
                  <div className={styles.checks}>
                    {EDITABLE_ROLES.filter(r => r.group === group).map(r => (
                      <label key={r.value} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={roles.includes(r.value)}
                          onChange={() => toggleRole(r.value)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

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
