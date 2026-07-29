'use client'

import Link from 'next/link'
import styles from './ActivityFeed.module.css'

interface Lead {
  id:           string
  contact_name: string
  company_name: string
  stage:        string
}

interface Activity {
  id:               string
  type:             string
  subject:          string | null
  body:             string | null
  outcome:          string | null
  duration_minutes: number | null
  direction:        string | null
  created_at:       string
  created_by:       string | null
  leads:            Lead | null
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  email_outbound: { label: 'Email sent',      icon: '✉',  color: 'var(--color-info)'     },
  email_inbound:  { label: 'Email received',  icon: '✉',  color: 'var(--color-info)'     },
  whatsapp_log:   { label: 'WhatsApp',        icon: '💬', color: 'var(--color-success)'  },
  call:           { label: 'Call',            icon: '📞', color: 'var(--color-warning)'  },
  site_visit:     { label: 'Site visit',      icon: '📍', color: 'var(--color-primary)'  },
  meeting:        { label: 'Meeting',         icon: '📅', color: 'var(--color-primary)'  },
  note:           { label: 'Note',            icon: '📝', color: 'var(--color-text-3)'   },
}

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { label: type.replace(/_/g, ' '), icon: '•', color: 'var(--color-text-3)' }
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(activities: Activity[]) {
  const groups: Record<string, Activity[]> = {}
  for (const a of activities) {
    const date = new Date(a.created_at)
    const today    = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    let label: string
    if (date.toDateString() === today.toDateString())     label = 'Today'
    else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(a)
  }
  return groups
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className={styles.emptyText}>No activity logged yet</div>
        <div className={styles.emptyHint}>Activities will appear here as leads are worked</div>
      </div>
    )
  }

  const groups = groupByDate(activities)

  return (
    <div className={styles.feed}>
      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className={styles.group}>
          <div className={styles.dateLabel}>{date}</div>
          <div className={styles.card}>
            {items.map((activity, idx) => {
              const config = getConfig(activity.type)
              const lead   = activity.leads as Lead | null

              return (
                <div
                  key={activity.id}
                  className={`${styles.row} ${idx < items.length - 1 ? styles.rowBorder : ''}`}
                >
                  {/* Icon */}
                  <div className={styles.iconWrap} style={{ color: config.color }}>
                    <span className={styles.icon}>{config.icon}</span>
                  </div>

                  {/* Content */}
                  <div className={styles.content}>
                    <div className={styles.rowTop}>
                      <span className={styles.activityType}>{config.label}</span>
                      {activity.direction && (
                        <span className={styles.direction}>{activity.direction}</span>
                      )}
                      {activity.duration_minutes && (
                        <span className={styles.meta}>{activity.duration_minutes} min</span>
                      )}
                    </div>

                    {lead && (
                      <Link href={`/leads/${lead.id}`} className={styles.leadLink}>
                        {lead.contact_name} · {lead.company_name}
                      </Link>
                    )}

                    {activity.subject && activity.subject !== config.label && (
                      <div className={styles.subject}>{activity.subject}</div>
                    )}

                    {activity.body && (
                      <div className={styles.body}>{activity.body}</div>
                    )}

                    {activity.outcome && (
                      <div className={styles.outcome}>Outcome: {activity.outcome}</div>
                    )}
                  </div>

                  {/* Time */}
                  <div className={styles.time}>{timeAgo(activity.created_at)}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
