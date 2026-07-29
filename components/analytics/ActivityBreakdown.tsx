'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import styles from './charts.module.css'

const COLORS = [
  'var(--color-primary)',
  'var(--stage-demo-bar)',
  'var(--stage-won-bar)',
  'var(--stage-negotiation-bar)',
  'var(--stage-proposal-bar)',
  'var(--stage-new-bar)',
]

interface ActivityData { name: string; value: number }

export default function ActivityBreakdown({ data }: { data: ActivityData[] }) {
  if (!data || data.length === 0 || data.every(d => d.value === 0)) {
    return <div className={styles.empty}>No data yet</div>
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className={styles.donutWrap}>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(val: number, name: string) => [`${val} (${Math.round((val/total)*100)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.legend}>
        {data.map((item, i) => (
          <div key={item.name} className={styles.legendRow}>
            <div
              className={styles.legendDot}
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className={styles.legendName}>{item.name}</span>
            <span className={styles.legendVal}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
