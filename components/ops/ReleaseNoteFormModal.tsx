'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Modal from '@/components/modals/Modal'
import Button from '@/components/ui/Button'
import {
  createOpsReleaseNote,
  updateOpsReleaseNote,
} from '@/lib/actions/ops-release-notes'
import type { OpsNestProduct } from '@/lib/ops/product'
import type { OpsReleaseNote } from '@/lib/ops-release-notes/types'
import styles from './ReleaseNoteFormModal.module.css'

const RichTextEditor = dynamic(
  () => import('@/components/contracts/RichTextEditor'),
  { ssr: false }
)

type Props = {
  product: OpsNestProduct
  initial?: OpsReleaseNote | null
  onClose: () => void
  onSaved: () => void
}

function toDateInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReleaseNoteFormModal({
  product,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [version, setVersion] = useState(initial?.version ?? '')
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html ?? '')
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false)
  const [publishedDate, setPublishedDate] = useState(
    toDateInput(initial?.published_at)
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        setError(null)
        const payload = {
          title,
          version: version || null,
          body_html: bodyHtml,
          is_published: isPublished,
          published_at:
            isPublished && publishedDate
              ? new Date(`${publishedDate}T12:00:00`).toISOString()
              : null,
        }
        if (initial) {
          await updateOpsReleaseNote(product, initial.id, payload)
        } else {
          await createOpsReleaseNote(product, payload)
        }
        onSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <Modal
      title={initial ? 'Edit release note' : 'New release note'}
      onClose={onClose}
      width={720}
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
            placeholder="e.g. March 2026 update"
          />
        </label>

        <div className={styles.row}>
          <label className={styles.label}>
            Version <span className={styles.optional}>(optional)</span>
            <input
              className={styles.input}
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 2.14.0"
            />
          </label>
          <label className={styles.label}>
            Publish date <span className={styles.optional}>(optional)</span>
            <input
              className={styles.input}
              type="date"
              value={publishedDate}
              onChange={e => setPublishedDate(e.target.value)}
              disabled={!isPublished}
            />
          </label>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={e => setIsPublished(e.target.checked)}
          />
          Published (visible on public page)
        </label>

        <div className={styles.label}>
          Notes
          <div className={styles.editorWrap}>
            <RichTextEditor
              content={bodyHtml}
              onChange={setBodyHtml}
              placeholder="What changed in this release…"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
