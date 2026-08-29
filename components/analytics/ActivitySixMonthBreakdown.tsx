'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  breakdownRowsForChart,
  type SixMonthActivityBreakdown,
} from '@/lib/dashboard/activity-breakdown'
import { useChartWidth } from './useChartWidth'
import styles from './charts.module.css'

const BAR_HEIGHT = 28

export default function ActivitySixMonthBreakdown({
  data,
}: {
  data: SixMonthActivityBreakdown
}) {
  const { ref, width } = useChartWidth()
  const chartRows = breakdownRowsForChart(data.rows)
  const total = chartRows.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return <div className={styles.empty}>No activity in the last 6 months</div>
  }

  const row: Record<string, number | string> = { name: 'Activities' }
  for (const item of chartRows) row[item.key] = item.value

  const visible = chartRows.filter(d => d.value > 0)
  const visibleTableRows = data.rows.filter(r => r.total > 0)

  return (
    <div className={styles.activitySixMonthWrap}>
      <div ref={ref} className={styles.fixedChart} style={{ height: BAR_HEIGHT }}>
        {width > 0 && (
          <BarChart
            width={width}
            height={BAR_HEIGHT}
            layout="vertical"
            data={[row]}
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="name" hide width={0} />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(val: number, key: string) => {
                const item = chartRows.find(d => d.key === key)
                const label = item?.label ?? key
                const pct = total > 0 ? Math.round((val / total) * 100) : 0
                return [`${val} (${pct}%)`, label]
              }}
            />
            {visible.map((item, i) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                stackId="activity"
                fill={item.color}
                radius={
                  visible.length === 1
                    ? [4, 4, 4, 4]
                    : i === 0
                      ? [4, 0, 0, 4]
                      : i === visible.length - 1
                        ? [0, 4, 4, 0]
                        : [0, 0, 0, 0]
                }
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </div>
      <div className={styles.activityTableScroll}>
        <table className={styles.activityMonthTable}>
          <thead>
            <tr>
              <th>Activity</th>
              {data.columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleTableRows.map(rowItem => (
              <tr key={rowItem.key}>
                <td>
                  <span className={styles.activityTypeCell}>
                    <span
                      className={styles.legendDot}
                      style={{ background: rowItem.color }}
                    />
                    {rowItem.label}
                  </span>
                </td>
                {rowItem.months.map((count, i) => (
                  <td key={data.columns[i].key} className={styles.activityMonthCount}>
                    {count || '—'}
                  </td>
                ))}
                <td className={styles.activityTotalCount}>{rowItem.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
