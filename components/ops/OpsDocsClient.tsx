'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import OpsDocFormModal from '@/components/ops/OpsDocFormModal'
import { deleteOpsDoc } from '@/lib/actions/ops-docs'
import type { OpsDoc, OpsEnumeration } from '@/lib/ops-docs/types'
import styles from './OpsDocsClient.module.css'

type Props = {
  docs: OpsDoc[]
  categories: OpsEnumeration[]
  subcategories: OpsEnumeration[]
  currentUserId: string
  isAdmin: boolean
}

type Section = {
  key: string
  categoryLabel: string
  subcategoryLabel: string
  categoryValue: string
  subcategoryValue: string
  items: OpsDoc[]
}

export default function OpsDocsClient({
  docs,
  categories,
  subcategories,
  currentUserId,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState<'all' | 'folder' | 'file'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OpsDoc | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const categoryLabel = useMemo(() => {
    const map = new Map(categories.map(c => [c.value, c.label]))
    return (value: string) => map.get(value) ?? value
  }, [categories])

  const subcategoryLabel = useMemo(() => {
    const map = new Map(subcategories.map(c => [c.value, c.label]))
    return (value: string) => map.get(value) ?? value
  }, [subcategories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter(d => {
      if (categoryFilter !== 'all' && d.category_value !== categoryFilter) return false
      if (subcategoryFilter !== 'all' && d.subcategory_value !== subcategoryFilter) {
        return false
      }
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [docs, search, categoryFilter, subcategoryFilter, kindFilter])

  const sections: Section[] = useMemo(() => {
    const orderCats = categories.map(c => c.value)
    const orderSubs = subcategories.map(c => c.value)
    const map = new Map<string, Section>()

    for (const doc of filtered) {
      const key = `${doc.category_value}::${doc.subcategory_value}`
      let section = map.get(key)
      if (!section) {
        section = {
          key,
          categoryValue: doc.category_value,
          subcategoryValue: doc.subcategory_value,
          categoryLabel: categoryLabel(doc.category_value),
          subcategoryLabel: subcategoryLabel(doc.subcategory_value),
          items: [],
        }
        map.set(key, section)
      }
      section.items.push(doc)
    }

    return [...map.values()].sort((a, b) => {
      const ca = orderCats.indexOf(a.categoryValue)
      const cb = orderCats.indexOf(b.categoryValue)
      if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb)
      const sa = orderSubs.indexOf(a.subcategoryValue)
      const sb = orderSubs.indexOf(b.subcategoryValue)
      return (sa === -1 ? 999 : sa) - (sb === -1 ? 999 : sb)
    })
  }, [filtered, categories, subcategories, categoryLabel, subcategoryLabel])

  function canEdit(doc: OpsDoc) {
    return isAdmin || doc.created_by === currentUserId
  }

  async function copyLink(doc: OpsDoc) {
    try {
      await navigator.clipboard.writeText(doc.url)
      setCopiedId(doc.id)
      window.setTimeout(() => setCopiedId(prev => (prev === doc.id ? null : prev)), 1500)
    } catch {
      setError('Could not copy link')
    }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        setError(null)
        await deleteOpsDoc(id)
        setConfirmDeleteId(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  const missingTaxonomy =
    categories.length === 0 || subcategories.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Docs</h1>
          <p className={styles.lead}>
            OneDrive folders and files for the Ops team. Links open in a new tab.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={missingTaxonomy}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          + Add link
        </Button>
      </div>

      {missingTaxonomy && (
        <p className={styles.banner} role="status">
          Add Doc categories and subcategories under Settings → Lists &amp; Values
          before creating links.
        </p>
      )}

      <div className={styles.filters}>
        <input
          className={styles.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or description…"
          aria-label="Search docs"
        />
        <select
          className={styles.select}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={subcategoryFilter}
          onChange={e => setSubcategoryFilter(e.target.value)}
          aria-label="Filter by subcategory"
        >
          <option value="all">All subcategories</option>
          {subcategories.map(c => (
            <option key={c.id} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value as 'all' | 'folder' | 'file')}
          aria-label="Filter by type"
        >
          <option value="all">Folders &amp; files</option>
          <option value="folder">Folders</option>
          <option value="file">Files</option>
        </select>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {sections.length === 0 ? (
        <p className={styles.empty}>
          {docs.length === 0
            ? 'No docs yet. Add a OneDrive folder or file link.'
            : 'No docs match these filters.'}
        </p>
      ) : (
        <div className={styles.sections}>
          {sections.map(section => (
            <section key={section.key} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {section.categoryLabel}
                <span className={styles.sectionSep}>·</span>
                {section.subcategoryLabel}
                <span className={styles.sectionCount}>{section.items.length}</span>
              </h2>
              <ul className={styles.list} role="list">
                {section.items.map(doc => (
                  <li key={doc.id} className={styles.row}>
                    <span
                      className={`${styles.kindIcon} ${
                        doc.kind === 'folder' ? styles.kindFolder : styles.kindFile
                      }`}
                      title={doc.kind === 'folder' ? 'Folder' : 'File'}
                      aria-hidden="true"
                    >
                      {doc.kind === 'folder' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          strokeLinejoin="round">
                          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                      )}
                    </span>
                    <div className={styles.meta}>
                      <div className={styles.docTitle}>{doc.title}</div>
                      {doc.description && (
                        <div className={styles.docDesc}>{doc.description}</div>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <a
                        className={styles.openBtn}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open ↗
                      </a>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => void copyLink(doc)}
                      >
                        {copiedId === doc.id ? 'Copied' : 'Copy'}
                      </button>
                      {canEdit(doc) && (
                        <>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => {
                              setEditing(doc)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </button>
                          {confirmDeleteId === doc.id ? (
                            <>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={isPending}
                                onClick={() => handleDelete(doc.id)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className={styles.ghostBtn}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.ghostBtn}
                              onClick={() => setConfirmDeleteId(doc.id)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {formOpen && !missingTaxonomy && (
        <OpsDocFormModal
          categories={categories}
          subcategories={subcategories}
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
