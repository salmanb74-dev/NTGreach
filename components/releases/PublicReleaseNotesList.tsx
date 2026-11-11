'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react'
import styles from '@/app/releases/releases.module.css'

export type PublicReleaseNote = {
  id: string
  title: string
  version: string | null
  body_html: string
  published_at: string | null
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Deterministic UTC date text — identical on server and browser. */
function formatDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function noteMatches(note: PublicReleaseNote, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    note.title,
    note.version ?? '',
    formatDate(note.published_at),
    stripHtml(note.body_html),
  ]
    .join(' ')
    .toLowerCase()
  return q.split(/\s+/).every(token => haystack.includes(token))
}

function hashId() {
  if (typeof window === 'undefined') return ''
  return window.location.hash.replace(/^#/, '')
}

function releaseAnchorId(id: string) {
  return `release-${id}`
}

export default function PublicReleaseNotesList({
  notes,
}: {
  notes: PublicReleaseNote[]
}) {
  // Stay collapsed until mount so SSR HTML matches the first client render
  // (avoids hydration mismatches from locale dates / rich body HTML).
  const [openId, setOpenId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null)

  const filtered = useMemo(
    () => notes.filter(note => noteMatches(note, query)),
    [notes, query]
  )

  const applyReleaseFromHash = useCallback(() => {
    const id = hashId()
    if (id && notes.some(note => note.id === id)) {
      setOpenId(id)
      setScrollTargetId(id)
      return true
    }
    return false
  }, [notes])

  useEffect(() => {
    setReady(true)
    if (!applyReleaseFromHash()) {
      setOpenId(notes[0]?.id ?? null)
    }
  }, [applyReleaseFromHash, notes])

  useEffect(() => {
    const onHashChange = () => {
      applyReleaseFromHash()
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [applyReleaseFromHash])

  useEffect(() => {
    if (!scrollTargetId) return
    const el = document.getElementById(releaseAnchorId(scrollTargetId))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollTargetId(null)
  }, [scrollTargetId, openId, filtered])

  useEffect(() => {
    if (!query.trim()) return
    if (openId && !filtered.some(note => note.id === openId)) {
      setOpenId(null)
    }
  }, [query, filtered, openId])

  function setOpen(id: string | null) {
    setOpenId(id)
    if (typeof window === 'undefined') return
    const next =
      id != null
        ? `${window.location.pathname}${window.location.search}#${id}`
        : `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, '', next)
  }

  async function copyShareLink(
    id: string,
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault()
    event.stopPropagation()
    const url = `${window.location.origin}${window.location.pathname}#${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      window.setTimeout(() => {
        setCopiedId(current => (current === id ? null : current))
      }, 1800)
    } catch {
      window.prompt('Copy this release link:', url)
    }
  }

  return (
    <div className={styles.listWrap}>
      <div className={styles.searchRow}>
        <label className={styles.searchLabel} htmlFor="release-search">
          Search releases
        </label>
        <input
          id="release-search"
          type="search"
          className={styles.searchInput}
          placeholder="Search by title, date, version..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No releases match your search.</p>
      ) : (
        <ol className={styles.list}>
          {filtered.map(note => {
            const open = ready && openId === note.id
            return (
              <li
                key={note.id}
                id={releaseAnchorId(note.id)}
                className={styles.item}
              >
                <div className={styles.itemHeader}>
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={open}
                    onClick={() => setOpen(open ? null : note.id)}
                  >
                    <div className={styles.toggleText}>
                      <div className={styles.itemMeta}>
                        {note.published_at && (
                          <time dateTime={note.published_at}>
                            {formatDate(note.published_at)}
                          </time>
                        )}
                        {note.version && (
                          <span className={styles.version}>
                            v{note.version}
                          </span>
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
                  <button
                    type="button"
                    className={styles.shareBtn}
                    onClick={e => copyShareLink(note.id, e)}
                    aria-label={
                      copiedId === note.id
                        ? 'Link copied'
                        : 'Copy link to this release'
                    }
                    title={
                      copiedId === note.id
                        ? 'Copied'
                        : 'Copy link to this release'
                    }
                  >
                    {copiedId === note.id ? 'Copied' : 'Share'}
                  </button>
                </div>
                {open && note.body_html ? (
                  <div
                    className={styles.body}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: note.body_html }}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
