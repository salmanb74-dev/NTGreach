import type { TimeLog } from '@/lib/support/time'
import {
  durationMs,
  formatClockDate,
  formatClockTime,
  formatDuration,
} from '@/lib/support/time'

export function exportTimesheetToExcel(opts: {
  logs:       TimeLog[]
  agentName:  string
  monthLabel: string
  year:       number
  month:      number
}) {
  return import('xlsx').then(XLSX => {
    const now = Date.now()
    const rows = opts.logs.map(log => ({
      Date:       formatClockDate(log.clock_in),
      'Clock In': formatClockTime(log.clock_in),
      'Clock Out': log.clock_out ? formatClockTime(log.clock_out) : 'Active',
      Duration:   log.clock_out
        ? formatDuration(durationMs(log.clock_in, log.clock_out, now))
        : 'Active',
      Notes:      log.notes ?? '',
    }))

    const totalMs = opts.logs.reduce(
      (sum, log) => sum + durationMs(log.clock_in, log.clock_out, now),
      0
    )
    rows.push({
      Date:        'TOTAL',
      'Clock In':  '',
      'Clock Out': '',
      Duration:    formatDuration(totalMs),
      Notes:       '',
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet')

    ws['!cols'] = [
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 40 },
    ]

    const safeName = opts.agentName.replace(/[^\w\- ]+/g, '').trim() || 'Agent'
    const file = `NTG-Reach-Timesheet-${safeName}-${opts.year}-${String(opts.month).padStart(2, '0')}.xlsx`
    XLSX.writeFile(wb, file)
  })
}
