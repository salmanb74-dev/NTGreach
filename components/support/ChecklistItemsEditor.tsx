'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import {
  createChecklistItem,
  deactivateChecklistItem,
  reorderChecklistItems,
  updateChecklistItem,
} from '@/lib/actions/support-checklists'
import {
  listTypeLabel,
  type ChecklistItem,
  type ChecklistListType,
} from '@/lib/support/checklists'
import styles from './Checklists.module.css'

interface Props {
  initialItems: ChecklistItem[]
  listPath: string
}

function EditorSection({
  listType,
  items,
  pending,
  onAdd,
  onRename,
  onRemove,
  onMove,
}: {
  listType: ChecklistListType
  items: ChecklistItem[]
  pending: boolean
  onAdd: (label: string) => void
  onRename: (id: string, label: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{listTypeLabel(listType)}</h3>
      <p className={styles.cardBody}>
        Changes apply to all restaurant checklists. New items show as to-do until marked.
      </p>

      <ul className={styles.templateList}>
        {items.map((item, index) => (
          <li key={item.id} className={styles.templateRow}>
            {editingId === item.id ? (
              <form
                className={styles.editRow}
                onSubmit={e => {
                  e.preventDefault()
                  onRename(item.id, editLabel)
                  setEditingId(null)
                }}
              >
                <input
                  className={styles.input}
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  disabled={pending}
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={pending || !editLabel.trim()}>
                  Save
                </Button>
                <button
                  type="button"
                  className={styles.textBtn}
                  disabled={pending}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className={styles.itemLabel}>{item.label}</span>
                <div className={styles.templateActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={pending || index === 0}
                    onClick={() => onMove(item.id, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    disabled={pending || index === items.length - 1}
                    onClick={() => onMove(item.id, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    disabled={pending}
                    onClick={() => {
                      setEditingId(item.id)
                      setEditLabel(item.label)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={pending}
                    onClick={() => {
                      if (confirm('Remove this item from the checklist template?')) {
                        onRemove(item.id)
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form
        className={styles.createRow}
        onSubmit={e => {
          e.preventDefault()
          if (!draft.trim()) return
          onAdd(draft)
          setDraft('')
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add item…"
          disabled={pending}
        />
        <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
          Add
        </Button>
      </form>
    </section>
  )
}

export default function ChecklistItemsEditor({ initialItems, listPath }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState(initialItems)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const byType = useMemo(() => {
    const onboarding = items
      .filter(i => i.list_type === 'onboarding')
      .sort((a, b) => a.sort_order - b.sort_order)
    const training = items
      .filter(i => i.list_type === 'training')
      .sort((a, b) => a.sort_order - b.sort_order)
    return { onboarding, training }
  }, [items])

  function run(action: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        router.refresh()
      }
    })
  }

  function handleAdd(listType: ChecklistListType, label: string) {
    run(async () => {
      const created = await createChecklistItem(listType, label)
      setItems(cur => [...cur, created])
    })
  }

  function handleRename(id: string, label: string) {
    const prev = items
    setItems(cur => cur.map(i => (i.id === id ? { ...i, label } : i)))
    run(async () => {
      try {
        await updateChecklistItem(id, { label })
      } catch (err) {
        setItems(prev)
        throw err
      }
    })
  }

  function handleRemove(id: string) {
    const prev = items
    setItems(cur => cur.filter(i => i.id !== id))
    run(async () => {
      try {
        await deactivateChecklistItem(id)
      } catch (err) {
        setItems(prev)
        throw err
      }
    })
  }

  function handleMove(listType: ChecklistListType, id: string, direction: -1 | 1) {
    const section = items
      .filter(i => i.list_type === listType)
      .sort((a, b) => a.sort_order - b.sort_order)
    const index = section.findIndex(i => i.id === id)
    const swap = index + direction
    if (index < 0 || swap < 0 || swap >= section.length) return

    const next = [...section]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    const orderedIds = next.map(i => i.id)
    const orderMap = new Map(orderedIds.map((oid, i) => [oid, (i + 1) * 10]))

    const prev = items
    setItems(cur =>
      cur.map(i =>
        i.list_type === listType && orderMap.has(i.id)
          ? { ...i, sort_order: orderMap.get(i.id)! }
          : i
      )
    )

    run(async () => {
      try {
        await reorderChecklistItems(listType, orderedIds)
      } catch (err) {
        setItems(prev)
        throw err
      }
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href={listPath} className={styles.backLink}>
            ← Resto checklists
          </Link>
          <h2 className={styles.title}>Checklist items</h2>
          <p className={styles.sub}>
            Edit the shared onboarding and training lists used for every Resto restaurant.
          </p>
        </div>
      </div>

      <EditorSection
        listType="onboarding"
        items={byType.onboarding}
        pending={pending}
        onAdd={label => handleAdd('onboarding', label)}
        onRename={handleRename}
        onRemove={handleRemove}
        onMove={(id, dir) => handleMove('onboarding', id, dir)}
      />
      <EditorSection
        listType="training"
        items={byType.training}
        pending={pending}
        onAdd={label => handleAdd('training', label)}
        onRename={handleRename}
        onRemove={handleRemove}
        onMove={(id, dir) => handleMove('training', id, dir)}
      />

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
