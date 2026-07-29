'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import styles from './charts.module.css'

interface WeeklyData { week: string; count: number }

export default function LeadsOverTimeChart({ data }: { data: WeeklyData[] }) {
  if (!data || data.length === 0) {
    return <div className={styles.empty}>No leads added in the last 8 weeks</div>
  }

  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
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
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
