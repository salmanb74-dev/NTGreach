'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import {
  setChecklistItemStatus,
  updateChecklistRestaurant,
} from '@/lib/actions/support-checklists'
import { openChecklistPrintWindow } from '@/lib/support/checklist-print'
import {
  countOpen,
  isOpenChecklistStatus,
  listTypeLabel,
  unresolvedChecklistStatus,
  type ChecklistLine,
  type ChecklistListType,
  type ChecklistRestaurant,
  type ChecklistStatusValue,
} from '@/lib/support/checklists'
import styles from './Checklists.module.css'

interface Props {
  restaurant: ChecklistRestaurant
  lines: ChecklistLine[]
  listPath: string
}

function StatusControls({
  status,
  disabled,
  onChange,
  clearTo,
}: {
  status: ChecklistStatusValue
  disabled: boolean
  onChange: (next: ChecklistStatusValue) => void
  clearTo: 'pending' | 'added_later'
}) {
  return (
    <div className={styles.statusGroup} role="group" aria-label="Item status">
      <button
        type="button"
        className={`${styles.statusBtn} ${status === 'done' ? styles.statusDone : ''}`}
        disabled={disabled}
        onClick={() => onChange(status === 'done' ? clearTo : 'done')}
      >
        Done
      </button>
      <button
        type="button"
        className={`${styles.statusBtn} ${
          status === 'not_required' ? styles.statusSkip : ''
        }`}
        disabled={disabled}
        onClick={() =>
          onChange(status === 'not_required' ? clearTo : 'not_required')
        }
      >
        Not required
      </button>
    </div>
  )
}

function ChecklistSection({
  listType,
  lines,
  restaurantCreatedAt,
  pending,
  onStatus,
}: {
  listType: ChecklistListType
  lines: ChecklistLine[]
  restaurantCreatedAt: string
  pending: boolean
  onStatus: (itemId: string, status: ChecklistStatusValue) => void
}) {
  const sectionLines = lines.filter(l => l.list_type === listType)
  const open = sectionLines.filter(l => isOpenChecklistStatus(l.status)).length
  const addedLater = sectionLines.filter(l => l.status === 'added_later').length

  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <h3 className={styles.cardTitle}>{listTypeLabel(listType)}</h3>
        <span className={open > 0 ? styles.pendingBadge : styles.completeBadge}>
          {open > 0
            ? addedLater > 0 && addedLater === open
              ? `${open} added later`
              : `${open} to do`
            : 'All set'}
        </span>
      </div>
      <ul className={styles.itemList}>
        {sectionLines.map(line => {
          const clearTo = unresolvedChecklistStatus(
            line.item_created_at,
            restaurantCreatedAt
          )
          const rowClass =
            line.status === 'pending'
              ? styles.itemPending
              : line.status === 'added_later'
                ? styles.itemAddedLater
                : ''
          return (
            <li key={line.item_id} className={`${styles.itemRow} ${rowClass}`}>
              <div className={styles.itemCopy}>
                <span className={styles.itemLabel}>{line.label}</span>
                {line.status === 'added_later' && (
                  <span className={styles.addedLaterTag}>Added later</span>
                )}
              </div>
              <StatusControls
                status={line.status}
                disabled={pending}
                clearTo={clearTo}
                onChange={next => onStatus(line.item_id, next)}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function ChecklistDetailClient({
  restaurant,
  lines: initialLines,
  listPath,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(restaurant.name)
  const [notes, setNotes] = useState(restaurant.notes ?? '')
  const [lines, setLines] = useState(initialLines)
  const [error, setError] = useState<string | null>(null)
  const [savedMeta, setSavedMeta] = useState(false)

  useEffect(() => {
    setName(restaurant.name)
    setNotes(restaurant.notes ?? '')
    setLines(initialLines)
  }, [restaurant.name, restaurant.notes, initialLines])

  const openTotal = useMemo(() => countOpen(lines), [lines])
  const addedLaterTotal = useMemo(
    () => lines.filter(l => l.status === 'added_later').length,
    [lines]
  )

  function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSavedMeta(false)
    startTransition(async () => {
      try {
        await updateChecklistRestaurant(restaurant.id, { name, notes })
        setSavedMeta(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleStatus(itemId: string, status: ChecklistStatusValue) {
    const prev = lines
    setLines(cur =>
      cur.map(l => (l.item_id === itemId ? { ...l, status } : l))
    )
    setError(null)
    startTransition(async () => {
      try {
        await setChecklistItemStatus(restaurant.id, itemId, status)
        router.refresh()
      } catch (err) {
        setLines(prev)
        setError(err instanceof Error ? err.message : 'Failed to update item')
      }
    })
  }

  function handlePrint() {
    openChecklistPrintWindow(
      { ...restaurant, name, notes: notes.trim() || null },
      lines
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href={listPath} className={styles.backLink}>
            ← All checklists
          </Link>
          <h2 className={styles.title}>{restaurant.name}</h2>
          <p className={styles.sub}>
            {openTotal > 0
              ? `${openTotal} item${openTotal === 1 ? '' : 's'} still open` +
                (addedLaterTotal > 0
                  ? ` (${addedLaterTotal} added after this checklist was created)`
                  : '')
              : 'All items marked done or not required'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
          Print / PDF
        </Button>
      </div>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Restaurant details</h3>
        <form className={styles.metaForm} onSubmit={handleSaveMeta}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              className={styles.input}
              value={name}
              onChange={e => {
                setName(e.target.value)
                setSavedMeta(false)
              }}
              disabled={pending}
            />
          </label>
          <label className={styles.field}>
            <span>Notes (optional)</span>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => {
                setNotes(e.target.value)
                setSavedMeta(false)
              }}
              rows={2}
              disabled={pending}
            />
          </label>
          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save details'}
            </Button>
            {savedMeta && !error && <span className={styles.ok}>Saved</span>}
          </div>
        </form>
      </section>

      <ChecklistSection
        listType="onboarding"
        lines={lines}
        restaurantCreatedAt={restaurant.created_at}
        pending={pending}
        onStatus={handleStatus}
      />
      <ChecklistSection
        listType="training"
        lines={lines}
        restaurantCreatedAt={restaurant.created_at}
        pending={pending}
        onStatus={handleStatus}
      />

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
