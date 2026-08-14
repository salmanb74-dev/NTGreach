/**
 * Deterministic datetime formatting for SSR + client (avoids hydration mismatches).
 */

export const APP_DATE_LOCALE = 'en-GB'

/** Absolute datetime in UTC (SSR-safe). */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return (
    d.toLocaleString(APP_DATE_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

/** Relative time for activity feeds / tables (client-friendly). */
export function timeAgo(dateStr: string | null | undefined): string {
  return relativeTime(dateStr, { style: 'compact' })
}

type RelativeTimeStyle = 'compact' | 'verbose'

type RelativeTimeOptions = {
  /** Label when date is missing or invalid */
  empty?: string
  /** Prepended label, e.g. "Last message" */
  prefix?: string
  style?: RelativeTimeStyle
  /** Locale for date fallback when older than 7 days */
  dateLocale?: string
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
 * Relative time with compact ("5m ago") or verbose ("5 mins ago") formatting.
 */
export function relativeTime(
  dateStr: string | null | undefined,
  options: RelativeTimeOptions = {}
): string {
  const {
    empty = '—',
    prefix,
    style = 'compact',
    dateLocale = APP_DATE_LOCALE,
  } = options

  if (!dateStr) return empty
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return empty

  const ms = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60_000)

  if (ms < 0 || mins < 1) {
    const label = 'just now'
    return prefix ? `${prefix} ${capitalize(label)}` : label
  }

  if (mins < 60) {
    const label =
      style === 'verbose'
        ? mins === 1
          ? '1 min ago'
          : `${mins} mins ago`
        : `${mins}m ago`
    return prefix ? `${prefix} ${label}` : label
  }

  const hours = Math.floor(mins / 60)
  if (hours < 24) {
    const label =
      style === 'verbose'
        ? hours === 1
          ? '1 hour ago'
          : `${hours} hours ago`
        : `${hours}h ago`
    return prefix ? `${prefix} ${label}` : label
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    const label =
      style === 'verbose'
        ? days === 1
          ? '1 day ago'
          : `${days} days ago`
        : `${days}d ago`
    return prefix ? `${prefix} ${label}` : label
  }

  const dateLabel = d.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
    ...(style === 'compact' ? { year: 'numeric' } : {}),
  })
  return prefix ? `${prefix} ${dateLabel}` : dateLabel
}

/** Support conversation list — verbose relative last-message time. */
export function formatLastMessageAgo(iso: string | null | undefined): string {
  return relativeTime(iso, {
    empty: 'No messages yet',
    prefix: 'Last message',
    style: 'verbose',
    dateLocale: 'en-PK',
  })
}
