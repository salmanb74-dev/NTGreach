'use client'

import { useState, useTransition } from 'react'
import Modal from '@/components/modals/Modal'
import Button from '@/components/ui/Button'
import { createOpsDoc, updateOpsDoc } from '@/lib/actions/ops-docs'
import type { OpsDoc, OpsDocKind, OpsEnumeration } from '@/lib/ops-docs/types'
import styles from './OpsDocFormModal.module.css'

type Props = {
  categories: OpsEnumeration[]
  subcategories: OpsEnumeration[]
  initial?: OpsDoc | null
  onClose: () => void
  onSaved: () => void
}

export default function OpsDocFormModal({
  categories,
  subcategories,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [kind, setKind] = useState<OpsDocKind>(initial?.kind ?? 'file')
  const [category, setCategory] = useState(
    initial?.category_value ?? categories[0]?.value ?? ''
  )
  const [subcategory, setSubcategory] = useState(
    initial?.subcategory_value ?? subcategories[0]?.value ?? ''
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        setError(null)
        const payload = {
          title,
          url,
          kind,
          category_value: category,
          subcategory_value: subcategory,
          description: description || null,
        }
        if (initial) {
          await updateOpsDoc(initial.id, payload)
        } else {
          await createOpsDoc(payload)
        }
        onSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <Modal
      title={initial ? 'Edit link' : 'Add link'}
      onClose={onClose}
      width={480}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          Title
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            autoFocus
            placeholder="e.g. Billing SOP"
          />
        </label>

        <label className={styles.label}>
          OneDrive URL
          <input
            className={styles.input}
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
            type="url"
            placeholder="https://…"
          />
        </label>

        <fieldset className={styles.kindField}>
          <legend className={styles.legend}>Type</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'folder'}
              onChange={() => setKind('folder')}
            />
            Folder
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name="kind"
              checked={kind === 'file'}
              onChange={() => setKind('file')}
            />
            File
          </label>
        </fieldset>

        <div className={styles.row}>
          <label className={styles.label}>
            Category
            <select
              className={styles.select}
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
            >
              {categories.map(c => (
                <option key={c.id} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Subcategory
            <select
              className={styles.select}
              value={subcategory}
              onChange={e => setSubcategory(e.target.value)}
              required
            >
              {subcategories.map(c => (
                <option key={c.id} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={styles.label}>
          Description <span className={styles.optional}>(optional)</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Short note for the team"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving…' : initial ? 'Save' : 'Add link'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
