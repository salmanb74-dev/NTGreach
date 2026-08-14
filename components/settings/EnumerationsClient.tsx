'use client'

import { useState, useTransition } from 'react'
import {
  addEnumeration, updateEnumeration,
  deleteEnumeration, reorderEnumeration
} from '@/lib/actions/settings'
import { useRouter } from 'next/navigation'
import styles from './Enumerations.module.css'

interface EnumItem {
  id: string
  category: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
}

interface Category { key: string; label: string }

export default function EnumerationsClient({
  grouped,
  categories,
}: {
  grouped: Record<string, EnumItem[] | null>
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

  function startEdit(item: EnumItem) {
    setError(null)
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditActive(item.is_active)
  }

  function handleSave(id: string) {
    startTransition(async () => {
      try {
        setError(null)
        await updateEnumeration(id, editLabel, editActive)
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
        await addEnumeration(activeTab, newLabel.trim(), newLabel.trim())
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
        await deleteEnumeration(id)
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
        await reorderEnumeration(id, dir)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder')
      }
    })
  }

  return (
    <div className={styles.wrap}>
      {/* Category tabs */}
      <div className={styles.tabs}>
        {categories.map(c => (
          <button
            key={c.key}
            className={`${styles.tab} ${activeTab === c.key ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab(c.key); setEditingId(null) }}
          >
            {c.label}
            <span className={styles.tabCount}>{grouped[c.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <p className={styles.hint}>
        <strong>Label</strong> is the display name. <strong>Value</strong> (right column) is the
        code stored in the app.
        {activeTab === 'currency' ? (
          <>
            {' '}
            Deal currency uses the value (e.g. <code>USD</code>); quotation templates use the text
            in brackets (e.g. <code>US$</code> from &quot;US Dollar (US$)&quot;).
          </>
        ) : (
          <>
            {' '}
            Edit only changes the label; use + Add for a new code.
          </>
        )}
      </p>

      {/* Items list */}
      <div className={styles.card}>
        {items.length === 0 && (
          <div className={styles.empty}>No items yet. Add one below.</div>
        )}
        {items.map((item, idx) => (
          <div key={item.id} className={`${styles.row} ${!item.is_active ? styles.inactive : ''}`}>
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
                <button className={styles.saveBtn} onClick={() => handleSave(item.id)} disabled={isPending}>Save</button>
                <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : confirmDelete === item.id ? (
              <div className={styles.editRow}>
                <span className={styles.deleteConfirmText}>Delete "{item.label}"?</span>
                <button className={styles.deleteConfirmBtn} onClick={() => handleDelete(item.id)} disabled={isPending}>
                  {isPending ? '…' : 'Yes, delete'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className={styles.reorderBtns}>
                  <button onClick={() => handleReorder(item.id, 'up')} disabled={idx === 0 || isPending} className={styles.reorderBtn}>↑</button>
                  <button onClick={() => handleReorder(item.id, 'down')} disabled={idx === items.length - 1 || isPending} className={styles.reorderBtn}>↓</button>
                </div>
                <div className={styles.itemLabel}>{item.label}</div>
                <div className={styles.itemValue}>{item.value}</div>
                {!item.is_active && <span className={styles.inactiveBadge}>Inactive</span>}
                <div className={styles.rowActions}>
                  <button className={styles.editBtn} onClick={() => startEdit(item)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => setConfirmDelete(item.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Add new */}
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={`Add new ${categories.find(c => c.key === activeTab)?.label.slice(0, -1).toLowerCase()}…`}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button className={styles.addBtn} onClick={handleAdd} disabled={!newLabel.trim() || isPending}>
            {isPending ? '…' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
