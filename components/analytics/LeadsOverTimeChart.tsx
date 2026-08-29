'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { useChartWidth } from './useChartWidth'
import styles from './charts.module.css'

interface WeeklyData { week: string; count: number }

const CHART_HEIGHT = 300

export default function LeadsOverTimeChart({
  data,
  weeks = 16,
}: {
  data: WeeklyData[]
  weeks?: number
}) {
  const { ref, width } = useChartWidth()

  if (!data || data.length === 0 || data.every(d => d.count === 0)) {
    return (
      <div className={styles.empty}>
        No leads added in the last {weeks} weeks
      </div>
    )
  }

  return (
    <div ref={ref} className={styles.fixedChart} style={{ height: CHART_HEIGHT }}>
      {width > 0 && (
        <BarChart
          width={width}
          height={CHART_HEIGHT}
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 9, fill: 'var(--color-text-3)' }}
            axisLine={false}
            tickLine={false}
            interval={1}
            angle={-45}
            textAnchor="end"
            height={36}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--color-text)',
            }}
            cursor={{ fill: 'var(--color-primary-subtle)' }}
            formatter={(val: number) => [val, 'Leads']}
          />
          <Bar
            dataKey="count"
            fill="var(--color-primary)"
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      )}
    </div>
  )
}
