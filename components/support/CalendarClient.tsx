'use client'

import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import AddShiftModal from './AddShiftModal'
import ShiftDetailModal from './ShiftDetailModal'
import type { OnDutyAgent } from '@/lib/support/shifts'
import {
  addDays,
  agentColorIndex,
  formatHourLabel,
  formatShiftTime,
  formatWeekLabel,
  layoutShiftsForDay,
  nowPositionInDay,
  sameDay,
  startOfWeek,
  type ShiftAgent,
  type ShiftItem,
} from '@/lib/support/shifts'
import styles from './CalendarClient.module.css'

interface Props {
  initialShifts: ShiftItem[]
  agents:        ShiftAgent[]
  onDuty:        OnDutyAgent | null
  canManage:     boolean
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, h) => h)

export default function CalendarClient({
  initialShifts,
  agents,
  onDuty,
  canManage,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState<string | undefined>()
  const [selected, setSelected] = useState<ShiftItem | null>(null)
  const today = useMemo(() => new Date(), [])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  function openAdd(day?: Date) {
    if (!canManage) return
    if (day) {
      const pad = (n: number) => n.toString().padStart(2, '0')
      setAddDate(
        `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
      )
    } else {
      setAddDate(undefined)
    }
    setShowAdd(true)
  }

  return (
    <div className={styles.shell}>
      <div
        className={`${styles.banner} ${
          onDuty ? styles.bannerOn : styles.bannerOff
        }`}
      >
        {onDuty ? (
          <>
            <span className={styles.bannerDot} aria-hidden="true" />
            <span>
              On duty now: <strong>{onDuty.agent_name}</strong>
              <span className={styles.bannerMeta}>
                {' '}
                · {formatShiftTime(onDuty.start_at)} – {formatShiftTime(onDuty.end_at)}
              </span>
            </span>
          </>
        ) : (
          <span>No one on duty — coverage gap</span>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekStart(d => addDays(d, -7))}
            aria-label="Previous week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekStart(d => addDays(d, 7))}
            aria-label="Next week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <h2 className={styles.weekLabel}>{formatWeekLabel(weekStart)}</h2>
        </div>

        {canManage && (
          <Button variant="primary" size="sm" onClick={() => openAdd()}>
            Add Shift
          </Button>
        )}
      </div>

      <div className={styles.scroll} role="grid" aria-label="Weekly roster">
        <div className={styles.headerRow}>
          <div className={styles.gutterSpacer} aria-hidden="true" />
          {days.map((day, i) => {
            const isToday = sameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={`${styles.dayHeader} ${isToday ? styles.dayHeaderToday : ''}`}
              >
                <span className={styles.dayName}>{DAY_LABELS[i]}</span>
                <span className={styles.dayNum}>{day.getDate()}</span>
                {canManage && (
                  <button
                    type="button"
                    className={styles.addDayBtn}
                    title="Add shift this day"
                    aria-label={`Add shift on ${DAY_LABELS[i]}`}
                    onClick={() => openAdd(day)}
                  >
                    +
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.bodyRow}>
          <div className={styles.timeGutter} aria-hidden="true">
            {HOURS.map(h => (
              <div key={h} className={styles.hourLabel}>
                {h === 0 ? '' : formatHourLabel(h)}
              </div>
            ))}
          </div>

          <div className={styles.days}>
            {days.map(day => {
              const isToday = sameDay(day, today)
              const laidOut = layoutShiftsForDay(initialShifts, day)
              const nowPct = nowPositionInDay(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`${styles.dayCol} ${isToday ? styles.dayColToday : ''}`}
                  role="gridcell"
                >
                  {HOURS.map(h => (
                    <div key={h} className={styles.hourLine} />
                  ))}

                  {nowPct !== null && (
                    <div
                      className={styles.nowLine}
                      style={{ ['--now-top' as string]: `${nowPct}%` }}
                      aria-hidden="true"
                    />
                  )}

                  {laidOut.map(item => {
                    const gap = 2
                    const widthPct = 100 / item.colCount
                    const leftPct = item.col * widthPct
                    return (
                      <button
                        key={item.shift.id}
                        type="button"
                        className={`${styles.block} ${styles[`c${agentColorIndex(item.shift.agent_id)}`]} ${
                          item.overlaps ? styles.blockOverlap : ''
                        }`}
                        style={{
                          ['--shift-top' as string]:    `${item.topPct}%`,
                          ['--shift-height' as string]: `${item.heightPct}%`,
                          ['--shift-left' as string]:   `calc(${leftPct}% + ${gap}px)`,
                          ['--shift-width' as string]:  `calc(${widthPct}% - ${gap * 2}px)`,
                        }}
                        onClick={() => setSelected(item.shift)}
                        title={`${item.shift.agent_name} · ${formatShiftTime(item.shift.start_at)}–${formatShiftTime(item.shift.end_at)}${
                          item.overlaps ? ' · overlaps another shift' : ''
                        }`}
                      >
                        <span className={styles.blockName}>{item.shift.agent_name}</span>
                        <span className={styles.blockTime}>
                          {formatShiftTime(item.shift.start_at)}–{formatShiftTime(item.shift.end_at)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddShiftModal
          agents={agents}
          existing={initialShifts}
          defaultDate={addDate}
          onClose={() => setShowAdd(false)}
        />
      )}

      {selected && (
        <ShiftDetailModal
          shift={selected}
          agents={agents}
          allShifts={initialShifts}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
