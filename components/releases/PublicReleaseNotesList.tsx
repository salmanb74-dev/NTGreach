'use client'

import { useState } from 'react'
import styles from '@/app/releases/releases.module.css'

export type PublicReleaseNote = {
  id: string
  title: string
  version: string | null
  body_html: string
  published_at: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PublicReleaseNotesList({
  notes,
}: {
  notes: PublicReleaseNote[]
}) {
  const [openId, setOpenId] = useState<string | null>(
    () => notes[0]?.id ?? null
  )

  return (
    <ol className={styles.list}>
      {notes.map(note => {
        const open = openId === note.id
        return (
          <li key={note.id} className={styles.item}>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : note.id)}
            >
              <div className={styles.toggleText}>
                <div className={styles.itemMeta}>
                  {note.published_at && (
                    <time dateTime={note.published_at}>
                      {formatDate(note.published_at)}
                    </time>
                  )}
                  {note.version && (
                    <span className={styles.version}>v{note.version}</span>
                  )}
                </div>
                <h2 className={styles.itemTitle}>{note.title}</h2>
              </div>
              <span className={styles.chevron} aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {open ? (
                    <path d="M18 15l-6-6-6 6" />
                  ) : (
                    <path d="M6 9l6 6 6-6" />
                  )}
                </svg>
              </span>
            </button>
            {open && note.body_html ? (
              <div
                className={styles.body}
                dangerouslySetInnerHTML={{ __html: note.body_html }}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
