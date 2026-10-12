'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import ReleaseNoteFormModal from '@/components/ops/ReleaseNoteFormModal'
import { deleteOpsReleaseNote } from '@/lib/actions/ops-release-notes'
import type { OpsNestProduct } from '@/lib/ops/product'
import type { OpsReleaseNote } from '@/lib/ops-release-notes/types'
import styles from './ReleaseNotesClient.module.css'

type Props = {
  product: OpsNestProduct
  notes: OpsReleaseNote[]
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function ReleaseNotesClient({ product, notes }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>(
    'all'
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OpsReleaseNote | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const productLabel = product === 'alma' ? 'Alma' : 'Resto'
  const publicPath = `/releases/${product}`

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes.filter(n => {
      if (statusFilter === 'published' && !n.is_published) return false
      if (statusFilter === 'draft' && n.is_published) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        (n.version ?? '').toLowerCase().includes(q)
      )
    })
  }, [notes, search, statusFilter])

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        setError(null)
        await deleteOpsReleaseNote(product, id)
        setConfirmDeleteId(null)
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
          <h1 className={styles.title}>Release notes</h1>
          <p className={styles.lead}>
            Publish {productLabel} updates for customers and partners. Drafts stay
            private until you publish.
          </p>
          <a
            className={styles.publicLink}
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open public page ↗
          </a>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          + New note
        </Button>
      </div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or version…"
          aria-label="Search release notes"
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={e =>
            setStatusFilter(e.target.value as 'all' | 'published' | 'draft')
          }
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {notes.length === 0
            ? 'No release notes yet. Add your first note.'
            : 'No notes match these filters.'}
        </p>
      ) : (
        <ul className={styles.list} role="list">
          {filtered.map(note => (
            <li key={note.id} className={styles.row}>
              <div className={styles.meta}>
                <div className={styles.noteTitle}>{note.title}</div>
                <div className={styles.noteSub}>
                  <span
                    className={`${styles.badge} ${
                      note.is_published
                        ? styles.badgePublished
                        : styles.badgeDraft
                    }`}
                  >
                    {note.is_published ? 'Published' : 'Draft'}
                  </span>
                  {note.version && <span>v{note.version}</span>}
                  <span>
                    {note.is_published
                      ? formatDate(note.published_at)
                      : `Updated ${formatDate(note.updated_at)}`}
                  </span>
                </div>
              </div>
              <div className={styles.actions}>
                {confirmDeleteId === note.id ? (
                  <div className={styles.confirmRow}>
                    Delete?
                    <button
                      type="button"
                      className={`${styles.ghostBtn} ${styles.danger}`}
                      disabled={isPending}
                      onClick={() => handleDelete(note.id)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      disabled={isPending}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => {
                        setEditing(note)
                        setFormOpen(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`${styles.ghostBtn} ${styles.danger}`}
                      onClick={() => setConfirmDeleteId(note.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <ReleaseNoteFormModal
          product={product}
          initial={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSaved={() => {
            setFormOpen(false)
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
