'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { clockIn, clockOut, getTimeLogs } from '@/lib/actions/support-time'
import { exportTimesheetToExcel } from '@/lib/exportTimesheet'
import {
  agentLabel,
  durationMs,
  formatClockDate,
  formatClockTime,
  formatDuration,
  formatElapsed,
  monthLabel,
  totalHoursLabel,
  type TimeAgent,
  type TimeLog,
} from '@/lib/support/time'
import styles from './TimeClient.module.css'

interface Props {
  currentUserId:   string
  currentUserName: string
  canViewAll:      boolean
  canExport:       boolean
  agents:          TimeAgent[]
  initialActive:   TimeLog | null
  initialLogs:     TimeLog[]
  initialMonth:    number
  initialYear:     number
}

export default function TimeClient({
  currentUserId,
  currentUserName,
  canViewAll,
  canExport,
  agents,
  initialActive,
  initialLogs,
  initialMonth,
  initialYear,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [active, setActive] = useState<TimeLog | null>(initialActive)
  const [notes, setNotes] = useState('')
  const [clockError, setClockError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [viewAgentId, setViewAgentId] = useState(currentUserId)
  const [logs, setLogs] = useState<TimeLog[]>(initialLogs)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Live elapsed counter while clocked in
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  // Sync active when server refreshes
  useEffect(() => {
    setActive(initialActive)
  }, [initialActive])

  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  const elapsed = active ? durationMs(active.clock_in, null, now) : 0
  const totalLabel = useMemo(() => totalHoursLabel(logs, now), [logs, now])

  const viewAgentName = useMemo(() => {
    if (viewAgentId === currentUserId) return currentUserName
    const agent = agents.find(a => a.id === viewAgentId)
    return agent ? agentLabel(agent) : 'Agent'
  }, [viewAgentId, currentUserId, currentUserName, agents])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setMonth(m)
    setYear(y)
    void loadLogs(viewAgentId, m, y)
  }

  async function loadLogs(agentId: string, m: number, y: number) {
    setSheetLoading(true)
    setSheetError(null)
    try {
      const next = await getTimeLogs(agentId, m, y)
      setLogs(next)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Failed to load timesheet')
    } finally {
      setSheetLoading(false)
    }
  }

  function handleAgentChange(agentId: string) {
    setViewAgentId(agentId)
    void loadLogs(agentId, month, year)
  }

  function handleClockIn() {
    setClockError(null)
    startTransition(async () => {
      try {
        const row = await clockIn()
        setActive(row)
        setNotes('')
        router.refresh()
        if (viewAgentId === currentUserId) {
          void loadLogs(currentUserId, month, year)
        }
      } catch (err) {
        setClockError(err instanceof Error ? err.message : 'Clock in failed')
      }
    })
  }

  function handleClockOut() {
    if (!active) return
    setClockError(null)
    startTransition(async () => {
      try {
        await clockOut(active.id, notes)
        setActive(null)
        setNotes('')
        router.refresh()
        if (viewAgentId === currentUserId) {
          void loadLogs(currentUserId, month, year)
        }
      } catch (err) {
        setClockError(err instanceof Error ? err.message : 'Clock out failed')
      }
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportTimesheetToExcel({
        logs,
        agentName:  viewAgentName,
        monthLabel: monthLabel(year, month),
        year,
        month,
      })
    } catch (err) {
      console.error(err)
      setSheetError('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.shell}>
      {/* ── Section A: Clock ───────────────────────────────────── */}
      <section className={`${styles.clockCard} ${active ? styles.clockActive : ''}`}>
        {!active ? (
          <>
            <div className={styles.clockCopy}>
              <h2 className={styles.clockTitle}>Ready to start?</h2>
              <p className={styles.clockSub}>
                Clock in to begin tracking your support shift.
              </p>
            </div>
            <button
              type="button"
              className={styles.clockInBtn}
              onClick={handleClockIn}
              disabled={pending}
            >
              {pending ? 'Clocking in…' : 'Clock In'}
            </button>
          </>
        ) : (
          <>
            <div className={styles.clockCopy}>
              <p className={styles.clockedLabel}>
                <span className={styles.liveDot} aria-hidden="true" />
                Clocked in
              </p>
              <p className={styles.clockedAt}>
                since {formatClockTime(active.clock_in)} · {formatClockDate(active.clock_in)}
              </p>
              <p className={styles.elapsed} aria-live="polite">
                {formatElapsed(elapsed)}
              </p>
            </div>

            <div className={styles.clockOutPanel}>
              <label className={styles.notesLabel} htmlFor="time-notes">
                Notes (optional)
              </label>
              <textarea
                id="time-notes"
                className={styles.notes}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you work on?"
                rows={2}
                disabled={pending}
              />
              <button
                type="button"
                className={styles.clockOutBtn}
                onClick={handleClockOut}
                disabled={pending}
              >
                {pending ? 'Clocking out…' : 'Clock Out'}
              </button>
            </div>
          </>
        )}
        {clockError && <p className={styles.error}>{clockError}</p>}
      </section>

      {/* ── Section B: Timesheet ───────────────────────────────── */}
      <section className={styles.sheet}>
        <div className={styles.sheetToolbar}>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              disabled={sheetLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className={styles.monthTitle}>{monthLabel(year, month)}</h2>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              disabled={sheetLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className={styles.sheetActions}>
            {canViewAll && (
              <select
                className={styles.agentSelect}
                value={viewAgentId}
                onChange={e => handleAgentChange(e.target.value)}
                aria-label="Select agent"
                disabled={sheetLoading}
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {agentLabel(a)}
                    {a.id === currentUserId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
            {canExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleExport()}
                disabled={exporting || sheetLoading || logs.length === 0}
              >
                {exporting ? 'Exporting…' : 'Export'}
              </Button>
            )}
          </div>
        </div>

        {sheetError && <p className={styles.error}>{sheetError}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sheetLoading && (
                <tr>
                  <td colSpan={5} className={styles.empty}>Loading…</td>
                </tr>
              )}
              {!sheetLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No time logs for this month.
                  </td>
                </tr>
              )}
              {!sheetLoading &&
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{formatClockDate(log.clock_in)}</td>
                    <td>{formatClockTime(log.clock_in)}</td>
                    <td>
                      {log.clock_out ? formatClockTime(log.clock_out) : '—'}
                    </td>
                    <td>
                      {log.clock_out ? (
                        formatDuration(durationMs(log.clock_in, log.clock_out, now))
                      ) : (
                        <span className={styles.activeBadge}>Active</span>
                      )}
                    </td>
                    <td className={styles.notesCell}>{log.notes || '—'}</td>
                  </tr>
                ))}
            </tbody>
            {!sheetLoading && logs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total hours</td>
                  <td colSpan={2}>{totalLabel}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}
