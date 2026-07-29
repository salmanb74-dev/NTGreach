'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/modals/Modal'
import Button from '@/components/ui/Button'
import { createRecurringShifts, createShift } from '@/lib/actions/support-shifts'
import {
  WEEKDAY_OPTIONS,
  addDays,
  agentDisplayName,
  buildShiftInterval,
  expandRecurringShifts,
  intervalsOverlap,
  toLocalDateString,
  type ShiftAgent,
  type ShiftItem,
} from '@/lib/support/shifts'
import modalStyles from '@/components/modals/modals.module.css'
import styles from './AddShiftModal.module.css'

interface Props {
  agents:       ShiftAgent[]
  existing:     ShiftItem[]
  defaultDate?: string // YYYY-MM-DD
  onClose:      () => void
}

function monthsAheadYmd(fromYmd: string, months: number): string {
  const d = new Date(`${fromYmd}T12:00:00`)
  d.setMonth(d.getMonth() + months)
  return toLocalDateString(d)
}

export default function AddShiftModal({
  agents,
  existing,
  defaultDate,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const today = toLocalDateString(new Date())

  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate ?? today)
  const [rangeStart, setRangeStart] = useState(defaultDate ?? today)
  const [rangeEnd, setRangeEnd] = useState(
    monthsAheadYmd(defaultDate ?? today, 6)
  )
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 4]) // Mon Tue Thu
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [error, setError] = useState<string | null>(null)

  const overnight = endTime <= startTime

  const preview = useMemo(() => {
    if (mode === 'once') {
      const interval = buildShiftInterval(date, startTime, endTime)
      return interval ? [interval] : []
    }
    return expandRecurringShifts({
      rangeStartYmd: rangeStart,
      rangeEndYmd:   rangeEnd,
      weekdays,
      startTime,
      endTime,
    })
  }, [mode, date, rangeStart, rangeEnd, weekdays, startTime, endTime])

  const overlapWarning = useMemo(() => {
    if (!agentId || preview.length === 0) return null
    let hits = 0
    for (const p of preview) {
      const hit = existing.find(
        s =>
          s.agent_id === agentId &&
          intervalsOverlap(p.startAt, p.endAt, s.start_at, s.end_at)
      )
      if (hit) hits += 1
    }
    if (!hits) return null
    if (mode === 'once') {
      return 'This overlaps an existing shift for this agent. You can still save.'
    }
    return `${hits} of ${preview.length} shifts overlap an existing shift for this agent. You can still save.`
  }, [agentId, preview, existing, mode])

  function toggleWeekday(day: number) {
    setWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => {
        // Mon-first order for display consistency
        const rank = (n: number) => (n === 0 ? 7 : n)
        return rank(a) - rank(b)
      })
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!agentId) {
      setError('Select an agent')
      return
    }

    if (mode === 'recurring' && weekdays.length === 0) {
      setError('Pick at least one weekday')
      return
    }

    if (preview.length === 0) {
      setError(
        overnight
          ? 'Invalid times — overnight shifts must end after start on the next day'
          : 'No shifts to create — check dates and times'
      )
      return
    }

    startTransition(async () => {
      try {
        if (mode === 'once') {
          await createShift(agentId, preview[0].startAt, preview[0].endAt)
        } else {
          await createRecurringShifts(agentId, preview)
        }
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create shift')
      }
    })
  }

  const weekdayLabels = weekdays
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => WEEKDAY_OPTIONS.find(o => o.value === d)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <Modal title="Add shift" onClose={pending ? () => {} : onClose} width={460}>
      <form className={modalStyles.form} onSubmit={handleSubmit}>
        <div className={styles.modeToggle} role="group" aria-label="Shift type">
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'once' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('once')}
            disabled={pending}
          >
            One-time
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'recurring' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('recurring')}
            disabled={pending}
          >
            Recurring
          </button>
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label} htmlFor="shift-agent">Agent</label>
          <select
            id="shift-agent"
            className={modalStyles.select}
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            required
            disabled={pending}
          >
            {agents.length === 0 && (
              <option value="">No CS agents found</option>
            )}
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {agentDisplayName(a)}
              </option>
            ))}
          </select>
        </div>

        {mode === 'once' ? (
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="shift-date">Date</label>
            <input
              id="shift-date"
              type="date"
              className={modalStyles.input}
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              disabled={pending}
            />
          </div>
        ) : (
          <>
            <div className={modalStyles.field}>
              <span className={modalStyles.label}>Repeat on</span>
              <div className={styles.weekdayRow}>
                {WEEKDAY_OPTIONS.map(d => {
                  const on = weekdays.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      type="button"
                      className={`${styles.weekdayBtn} ${on ? styles.weekdayBtnOn : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleWeekday(d.value)}
                      disabled={pending}
                      title={d.label}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.timeRow}>
              <div className={modalStyles.field}>
                <label className={modalStyles.label} htmlFor="shift-from">From</label>
                <input
                  id="shift-from"
                  type="date"
                  className={modalStyles.input}
                  value={rangeStart}
                  onChange={e => {
                    setRangeStart(e.target.value)
                    if (e.target.value > rangeEnd) {
                      setRangeEnd(monthsAheadYmd(e.target.value, 6))
                    }
                  }}
                  required
                  disabled={pending}
                />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.label} htmlFor="shift-until">Until</label>
                <input
                  id="shift-until"
                  type="date"
                  className={modalStyles.input}
                  value={rangeEnd}
                  min={rangeStart}
                  onChange={e => setRangeEnd(e.target.value)}
                  required
                  disabled={pending}
                />
              </div>
            </div>

            <div className={styles.quickRange}>
              <button
                type="button"
                className={styles.quickBtn}
                disabled={pending}
                onClick={() => setRangeEnd(monthsAheadYmd(rangeStart, 3))}
              >
                3 months
              </button>
              <button
                type="button"
                className={styles.quickBtn}
                disabled={pending}
                onClick={() => setRangeEnd(monthsAheadYmd(rangeStart, 6))}
              >
                6 months
              </button>
              <button
                type="button"
                className={styles.quickBtn}
                disabled={pending}
                onClick={() => setRangeEnd(toLocalDateString(addDays(new Date(`${rangeStart}T12:00:00`), 365)))}
              >
                1 year
              </button>
            </div>
          </>
        )}

        <div className={styles.timeRow}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="shift-start">Start</label>
            <input
              id="shift-start"
              type="time"
              className={modalStyles.input}
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="shift-end">End</label>
            <input
              id="shift-end"
              type="time"
              className={modalStyles.input}
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              required
              disabled={pending}
            />
          </div>
        </div>

        {overnight && (
          <p className={styles.hint}>
            Overnight shift — ends the next calendar day (e.g. 5:00 PM → 1:00 AM).
          </p>
        )}

        {mode === 'recurring' && preview.length > 0 && (
          <p className={styles.preview}>
            Will create <strong>{preview.length}</strong> shift
            {preview.length === 1 ? '' : 's'}
            {weekdayLabels ? ` on ${weekdayLabels}` : ''}
            {' '}from {rangeStart} to {rangeEnd}.
          </p>
        )}

        {overlapWarning && (
          <p className={styles.warn}>{overlapWarning}</p>
        )}
        {error && <p className={styles.error}>{error}</p>}

        <div className={modalStyles.footerSimple}>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending || !agentId || preview.length === 0}
          >
            {pending
              ? 'Saving…'
              : mode === 'once'
                ? 'Save shift'
                : `Save ${preview.length} shifts`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
