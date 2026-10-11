'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import {
  createChecklistRestaurant,
  deleteChecklistRestaurant,
} from '@/lib/actions/support-checklists'
import type { ChecklistRestaurant } from '@/lib/support/checklists'
import styles from './Checklists.module.css'

interface Props {
  initialRestaurants: ChecklistRestaurant[]
  basePath: string
  itemsPath: string
  canEditItems?: boolean
}

export default function ChecklistRestaurantsClient({
  initialRestaurants,
  basePath,
  itemsPath,
  canEditItems = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialRestaurants
    return initialRestaurants.filter(r => r.name.toLowerCase().includes(q))
  }, [initialRestaurants, query])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const created = await createChecklistRestaurant(name)
        setName('')
        router.push(`${basePath}/${created.id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create')
      }
    })
  }

  function handleDelete(id: string, restaurantName: string) {
    if (!confirm(`Delete checklist for “${restaurantName}”? This cannot be undone.`)) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await deleteChecklistRestaurant(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Resto checklists</h2>
          <p className={styles.sub}>
            Track onboarding prerequisites and staff training per restaurant.
            Items still to do are highlighted on each checklist.
          </p>
        </div>
        {canEditItems && (
          <Link href={itemsPath} className={styles.secondaryLink}>
            Edit checklist items
          </Link>
        )}
      </div>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>New restaurant</h3>
        <p className={styles.cardBody}>
          Enter the restaurant name manually — it does not need to match a tenant id.
        </p>
        <form className={styles.createRow} onSubmit={handleCreate}>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Restaurant name"
            disabled={pending}
            aria-label="Restaurant name"
          />
          <Button type="submit" variant="primary" size="sm" disabled={pending || !name.trim()}>
            {pending ? 'Creating…' : 'Create checklist'}
          </Button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.listToolbar}>
          <h3 className={styles.cardTitle}>Saved checklists</h3>
          <input
            className={styles.search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search restaurants"
          />
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {initialRestaurants.length === 0
              ? 'No restaurant checklists yet.'
              : 'No matches.'}
          </p>
        ) : (
          <ul className={styles.restaurantList}>
            {filtered.map(row => {
              const pendingCount = row.pending_count ?? 0
              const total = row.total_count ?? 0
              return (
                <li key={row.id} className={styles.restaurantRow}>
                  <Link href={`${basePath}/${row.id}`} className={styles.restaurantLink}>
                    <span className={styles.restaurantName}>{row.name}</span>
                    <span
                      className={
                        pendingCount > 0 ? styles.pendingBadge : styles.completeBadge
                      }
                    >
                      {pendingCount > 0
                        ? `${pendingCount} to do`
                        : total > 0
                          ? 'Complete'
                          : 'No items'}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={pending}
                    onClick={() => handleDelete(row.id, row.name)}
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
