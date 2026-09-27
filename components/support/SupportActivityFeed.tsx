'use client'

import styles from '@/components/activity/ActivityFeed.module.css'
import local from './SupportActivityFeed.module.css'
import { timeAgo } from '@/lib/format-when'
import type {
  DirectionCounts,
  SupportActivityRow,
} from './types'

function typeBreakdown(counts: DirectionCounts) {
  const parts: string[] = []
  if (counts.text)  parts.push(`${counts.text} text`)
  if (counts.image) parts.push(`${counts.image} image`)
  if (counts.voice) parts.push(`${counts.voice} voice`)
  if (counts.video) parts.push(`${counts.video} video`)
  if (counts.file)  parts.push(`${counts.file} file`)
  return parts.join(' · ')
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
}: {
  rows: SupportActivityRow[]
}) {
  if (rows.length === 0) {
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
  }>()

  for (const row of rows) {
    const group = groups.get(row.dateKey) ?? { dateLabel: row.dateLabel, rows: [] }
    group.rows.push(row)
    groups.set(row.dateKey, group)
  }

  return (
    <div className={styles.feed}>
      {[...groups.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dateKey, group]) => (
        <div key={dateKey} className={styles.group}>
          <div className={styles.dateLabel}>{group.dateLabel}</div>
          <div className={styles.card}>
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
