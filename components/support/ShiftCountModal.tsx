'use client'

import { useEffect, useState, useTransition } from 'react'
import Modal from '@/components/modals/Modal'
import Button from '@/components/ui/Button'
import { countShiftsByAgent } from '@/lib/actions/support-shifts'
import type { SupportProduct } from '@/lib/support/product'
import {
  toLocalDateString,
  type ShiftCountRange,
  type ShiftCountRow,
} from '@/lib/support/shifts'
import modalStyles from '@/components/modals/modals.module.css'
import styles from './ShiftCountModal.module.css'

const HISTORY_MAX = 3

function historyKey(product: SupportProduct) {
  return `support-shift-count-ranges:${product}`
}

interface Props {
  product: SupportProduct
  onClose: () => void
}

function loadHistory(product: SupportProduct): ShiftCountRange[] {
  try {
    const raw = localStorage.getItem(historyKey(product))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ShiftCountRange[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        r =>
          r &&
          typeof r.start === 'string' &&
          typeof r.end === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.end)
      )
      .slice(0, HISTORY_MAX)
  } catch {
    return []
  }
}

function saveHistory(product: SupportProduct, ranges: ShiftCountRange[]) {
  try {
    localStorage.setItem(
      historyKey(product),
      JSON.stringify(ranges.slice(0, HISTORY_MAX))
    )
  } catch {
    /* ignore quota */
  }
}

function rememberRange(
  product: SupportProduct,
  start: string,
  end: string
): ShiftCountRange[] {
  const next: ShiftCountRange[] = [
    { start, end },
    ...loadHistory(product).filter(r => !(r.start === start && r.end === end)),
  ].slice(0, HISTORY_MAX)
  saveHistory(product, next)
  return next
}

function formatRangeLabel(r: ShiftCountRange): string {
  return `${r.start} → ${r.end}`
}

export default function ShiftCountModal({ product, onClose }: Props) {
  const [pending, startTransition] = useTransition()
  const today = toLocalDateString(new Date())
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [history, setHistory] = useState<ShiftCountRange[]>([])
  const [rows, setRows] = useState<ShiftCountRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [resultRange, setResultRange] = useState<ShiftCountRange | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setHistory(loadHistory(product))
    setRows(null)
    setResultRange(null)
    setError(null)
  }, [product])

  function runCount(rangeStart: string, rangeEnd: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await countShiftsByAgent(rangeStart, rangeEnd, product)
        setRows(result.rows)
        setTotal(result.total)
        setResultRange({ start: result.start, end: result.end })
        setHistory(rememberRange(product, result.start, result.end))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Count failed')
        setRows(null)
        setResultRange(null)
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (end < start) {
      setError('End date must be on or after start date')
      return
    }
    runCount(start, end)
  }

  return (
    <Modal title="Shift counts" onClose={pending ? () => {} : onClose} width={440}>
      <form className={modalStyles.form} onSubmit={handleSubmit}>
        <p className={styles.hint}>
          Counts shifts by start day (inclusive). Overnight shifts count on the day they start.
        </p>

        <div className={styles.dateRow}>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="count-start">
              From
            </label>
            <input
              id="count-start"
              type="date"
              className={modalStyles.input}
              value={start}
              onChange={e => setStart(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="count-end">
              To
            </label>
            <input
              id="count-end"
              type="date"
              className={modalStyles.input}
              value={end}
              min={start}
              onChange={e => setEnd(e.target.value)}
              required
              disabled={pending}
            />
          </div>
        </div>

        {history.length > 0 && (
          <div className={styles.history}>
            <p className={styles.historyTitle}>Last checked</p>
            <ul className={styles.historyList}>
              {history.map(r => (
                <li key={`${r.start}_${r.end}`} className={styles.historyItem}>
                  {formatRangeLabel(r)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {rows && resultRange && (
          <div className={styles.results}>
            <p className={styles.resultsTitle}>
              {resultRange.start} → {resultRange.end}
              <span>
                {total} shift{total === 1 ? '' : 's'} · {rows.length} agent
                {rows.length === 1 ? '' : 's'}
              </span>
            </p>
            {rows.length === 0 ? (
              <p className={styles.empty}>No shifts in this range.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Shifts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.agent_id}>
                      <td>{r.agent_name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{total}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        <div className={modalStyles.footerSimple}>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={pending}
          >
            Close
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending || !start || !end}
          >
            {pending ? 'Counting…' : 'Calculate'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
