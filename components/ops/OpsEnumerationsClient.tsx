'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addOpsEnumeration,
  updateOpsEnumeration,
  deleteOpsEnumeration,
  reorderOpsEnumeration,
} from '@/lib/actions/ops-docs'
import type { OpsEnumeration } from '@/lib/ops-docs/types'
import styles from '@/components/settings/Enumerations.module.css'

type Category = { key: string; label: string }

export default function OpsEnumerationsClient({
  grouped,
  categories,
}: {
  grouped: Record<string, OpsEnumeration[]>
  categories: Category[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(categories[0].key)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = grouped[activeTab] ?? []

  function startEdit(item: OpsEnumeration) {
    setError(null)
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditActive(item.is_active)
  }

  function handleSave(id: string) {
    startTransition(async () => {
      try {
        setError(null)
        await updateOpsEnumeration(id, editLabel, editActive)
        setEditingId(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleAdd() {
    if (!newLabel.trim()) return
    startTransition(async () => {
      try {
        setError(null)
        await addOpsEnumeration(activeTab, newLabel.trim())
        setNewLabel('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        setError(null)
        await deleteOpsEnumeration(id)
        setConfirmDelete(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  function handleReorder(id: string, dir: 'up' | 'down') {
    startTransition(async () => {
      try {
        setError(null)
        await reorderOpsEnumeration(id, dir)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder')
      }
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {categories.map(c => (
          <button
            key={c.key}
            type="button"
            className={`${styles.tab} ${activeTab === c.key ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab(c.key)
              setEditingId(null)
              setNewLabel('')
            }}
          >
            {c.label}
            <span className={styles.tabCount}>{grouped[c.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.hint}>
        Used only by platform Ops <strong>Docs</strong>. Categories group products
        (Alma, Resto, …); subcategories sit under each (Engineering, Sales &amp;
        Marketing, General). Deactivating hides an option from new links.
      </p>

      <div className={styles.card}>
        {items.length === 0 && (
          <div className={styles.empty}>No items yet. Add one below.</div>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`${styles.row} ${!item.is_active ? styles.inactive : ''}`}
          >
            {editingId === item.id ? (
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  autoFocus
                />
                <label className={styles.activeToggle}>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={e => setEditActive(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={() => handleSave(item.id)}
                  disabled={isPending}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </div>
            ) : confirmDelete === item.id ? (
              <div className={styles.editRow}>
                <span className={styles.deleteConfirmText}>
                  Delete &quot;{item.label}&quot;?
                </span>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  onClick={() => handleDelete(item.id)}
                  disabled={isPending}
                >
                  {isPending ? '…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className={styles.reorderBtns}>
                  <button
                    type="button"
                    onClick={() => handleReorder(item.id, 'up')}
                    disabled={idx === 0 || isPending}
                    className={styles.reorderBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(item.id, 'down')}
                    disabled={idx === items.length - 1 || isPending}
                    className={styles.reorderBtn}
                  >
                    ↓
                  </button>
                </div>
                <div className={styles.itemLabel}>{item.label}</div>
                <div className={styles.itemValue}>{item.value}</div>
                {!item.is_active && (
                  <span className={styles.inactiveBadge}>Inactive</span>
                )}
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={`Add new ${
              categories.find(c => c.key === activeTab)?.label.slice(0, -1).toLowerCase() ??
              'item'
            }…`}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={isPending || !newLabel.trim()}
          >
            {isPending ? '…' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
