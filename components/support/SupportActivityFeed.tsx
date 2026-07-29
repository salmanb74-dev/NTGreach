'use client'

import styles from '@/components/activity/ActivityFeed.module.css'
import local from './SupportActivityFeed.module.css'
import type {
  DirectionCounts,
  SupportActivityRow,
  SupportTimeDay,
} from './types'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function typeBreakdown(counts: DirectionCounts) {
  const parts: string[] = []
  if (counts.text)  parts.push(`${counts.text} text`)
  if (counts.image) parts.push(`${counts.image} image`)
  if (counts.voice) parts.push(`${counts.voice} voice`)
  if (counts.video) parts.push(`${counts.video} video`)
  return parts.join(' · ')
}

function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', {
    timeZone: 'Asia/Karachi',
    hour:     'numeric',
    minute:   '2-digit',
  })
}

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function CountLine({
  label,
  tagClass,
  counts,
}: {
  label:    string
  tagClass: string
  counts:   DirectionCounts
}) {
  return (
    <div className={local.line}>
      <span className={`${local.tag} ${tagClass}`}>{label}</span>
      {counts.total > 0 ? (
        <span className={local.breakdown}>
          {counts.total} {counts.total === 1 ? 'message' : 'messages'}
          {typeBreakdown(counts) && ` · ${typeBreakdown(counts)}`}
        </span>
      ) : (
        <span className={`${local.breakdown} ${local.none}`}>no messages</span>
      )}
    </div>
  )
}

export default function SupportActivityFeed({
  rows,
  timeDays,
}: {
  rows:     SupportActivityRow[]
  timeDays: SupportTimeDay[]
}) {
  if (rows.length === 0 && timeDays.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className={styles.emptyText}>No messages yet</div>
        <div className={styles.emptyHint}>Agent chat activity will show up here</div>
      </div>
    )
  }

  const groups = new Map<string, {
    dateLabel: string
    rows:      SupportActivityRow[]
    timeDay?:  SupportTimeDay
  }>()

  for (const row of rows) {
    const group = groups.get(row.dateKey) ?? { dateLabel: row.dateLabel, rows: [] }
    group.rows.push(row)
    groups.set(row.dateKey, group)
  }

  for (const timeDay of timeDays) {
    const group = groups.get(timeDay.dateKey) ?? {
      dateLabel: timeDay.dateLabel,
      rows:      [],
    }
    group.timeDay = timeDay
    groups.set(timeDay.dateKey, group)
  }

  return (
    <div className={styles.feed}>
      {[...groups.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dateKey, group]) => (
        <div key={dateKey} className={styles.group}>
          <div className={styles.dateLabel}>{group.dateLabel}</div>
          <div className={styles.card}>
            {group.timeDay && (
              <div className={`${styles.row} ${group.rows.length > 0 ? styles.rowBorder : ''}`}>
                <div className={styles.iconWrap} style={{ color: 'var(--color-success)' }}>
                  <span className={styles.icon}>⏱</span>
                </div>

                <div className={styles.content}>
                  <div className={styles.rowTop}>
                    <span className={styles.activityType}>Clocked in</span>
                    <span className={styles.direction}>
                      {formatDuration(group.timeDay.durationMs)} total
                    </span>
                  </div>

                  <div className={local.clockSessions}>
                    {group.timeDay.sessions.map(session => (
                      <div key={session.id} className={local.clockSession}>
                        <span>{formatClockTime(session.clockIn)}</span>
                        <span aria-hidden="true">→</span>
                        <span>
                          {session.clockOut ? formatClockTime(session.clockOut) : 'Still in'}
                        </span>
                        <span className={local.clockDuration}>
                          {formatDuration(session.durationMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {group.rows.map((row, idx) => (
              <div
                key={row.key}
                className={`${styles.row} ${idx < group.rows.length - 1 ? styles.rowBorder : ''}`}
              >
                <div className={styles.iconWrap} style={{ color: 'var(--color-info)' }}>
                  <span className={styles.icon}>💬</span>
                </div>

                <div className={styles.content}>
                  <div className={styles.rowTop}>
                    <span className={styles.activityType}>{row.tenantName}</span>
                  </div>

                  <div className={local.lines}>
                    <CountLine label="Rep" tagClass={local.tagRep} counts={row.sent} />
                    <CountLine
                      label="Customer"
                      tagClass={local.tagCustomer}
                      counts={row.received}
                    />
                  </div>
                </div>

                <div className={styles.time}>{timeAgo(row.lastAt)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
