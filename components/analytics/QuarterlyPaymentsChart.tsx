'use client'

import { memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/currency'
import {
  CHART_PAYMENT_RECURRING,
  CHART_PAYMENT_SETUP,
} from '@/lib/dashboard/chart-colors'
import type { QuarterPaymentDatum } from '@/lib/dashboard/deal-values'
import { useChartWidth } from './useChartWidth'
import styles from './charts.module.css'

const CHART_HEIGHT = 272

function QuarterlyPaymentsChart({
  data,
  currency,
}: {
  data: QuarterPaymentDatum[]
  currency: string
}) {
  const { ref, width } = useChartWidth()

  if (!data.length || data.every(d => d.total === 0)) {
    return <div className={styles.empty}>No expected payments in view</div>
  }

  return (
    <div className={styles.quarterlyChartWrap}>
      <div className={styles.quarterlyLegend}>
        <span className={styles.quarterlyLegendItem}>
          <span className={styles.quarterlyDotSetup} /> Setup
        </span>
        <span className={styles.quarterlyLegendItem}>
          <span className={styles.quarterlyDotRecurring} /> Recurring
        </span>
      </div>
      <div ref={ref} className={styles.fixedChart} style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <BarChart
            width={width}
            height={CHART_HEIGHT}
            data={data}
            margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(val: number, name: string) => [
                formatCurrency(val, currency),
                name === 'setup' ? 'Setup' : 'Recurring',
              ]}
            />
            <Bar
              dataKey="setup"
              stackId="pay"
              fill={CHART_PAYMENT_SETUP}
              isAnimationActive={false}
              maxBarSize={32}
            />
            <Bar
              dataKey="recurring"
              stackId="pay"
              fill={CHART_PAYMENT_RECURRING}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              maxBarSize={32}
            />
          </BarChart>
        )}
      </div>
    </div>
  )
}

export default memo(QuarterlyPaymentsChart)
