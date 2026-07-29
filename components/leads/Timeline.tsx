'use client'

import { useState } from 'react'
import styles from './Timeline.module.css'

interface Activity {
  id: string
  type: string
  subject: string | null
  body: string | null
  duration_minutes: number | null
  outcome: string | null
  direction: string | null
  created_at: string
}

const ACTIVITY_ICONS: Record<string, string> = {
  email: '✉', whatsapp: '💬', meeting: '📅', call: '📞', note: '📝', stage: '🔄', site_visit: '📍'
}


const ACTIVITY_LABELS: Record<string, string> = {
  email_outbound: 'Email sent',
  email_inbound:  'Email received',
  whatsapp_log:   'WhatsApp note',
  call:           'Call logged',
  meeting:        'Meeting',
  note:           'Note',
  stage_change:   'Stage changed',
  site_visit: 'Site visit',
}

function getTypeKey(type: string) {
  if (type.includes('email'))    return 'email'
  if (type.includes('whatsapp')) return 'whatsapp'
  if (type.includes('meeting'))  return 'meeting'
  if (type.includes('call'))     return 'call'
  if (type.includes('stage'))    return 'stage'
  if (type.includes('visit')) return 'site_visit'
  return 'note'
}

export default function Timeline({ activities }: { activities: Activity[] }) {
  const [showStageChanges, setShowStageChanges] = useState(false)

  const filtered = activities.filter(item =>
    showStageChanges ? true : item.type !== 'stage_change'
  )

  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineHeader}>
        <div>
          <span className={styles.timelineTitle}>Activity Timeline</span>
          <span className={styles.timelineHint}>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showStageChanges}
            onChange={e => setShowStageChanges(e.target.checked)}
            className={styles.toggleInput}
          />
          <span className={styles.toggleTrack}>
            <span className={styles.toggleThumb} />
          </span>
          <span className={styles.toggleLabel}>Show stage changes</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.timelineEmpty}>
          {activities.length === 0
            ? 'No activity yet — send an email, log a call, or note a WhatsApp conversation.'
            : 'No activity to show. Enable "Show stage changes" to see all entries.'}
        </div>
      ) : (
        <div className={styles.timeline}>
          {filtered.map(item => {
            const typeKey = getTypeKey(item.type)
            return (
              <div key={item.id} className={styles.timelineItem}>
                <div
                  className={styles.timelineIcon}
                  style={{
                    background: typeKey === 'stage'
                      ? 'var(--color-surface-2)'
                      : `var(--activity-${typeKey}-bg)`,
                    color: typeKey === 'stage'
                      ? 'var(--color-text-3)'
                      : `var(--activity-${typeKey}-color)`,
                  }}
                >
                  {ACTIVITY_ICONS[typeKey]}
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineSubject}>
                    {ACTIVITY_LABELS[item.type] ?? item.type.replace(/_/g, ' ')}
                    {item.subject && item.subject !== ACTIVITY_LABELS[item.type] && (
                      <span className={styles.timelineSubjectDetail}> — {item.subject}</span>
                    )}
                  </div>
                  {item.body && <div className={styles.timelineBody}>{item.body}</div>}
                  {item.duration_minutes && (
                    <div className={styles.timelineMeta}>{item.duration_minutes} min</div>
                  )}
                  {item.outcome && (
                    <div className={styles.timelineMeta}>{item.outcome}</div>
                  )}
                  <div className={styles.timelineTime}>
                    {new Date(item.created_at).toLocaleString('en-PK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {item.direction && (
                      <span className={styles.directionTag}>{item.direction}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
