'use client'

import { useEffect, useRef, useState } from 'react'

/** Stable container width for Recharts — avoids ResponsiveContainer resize loops. */
export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let frame = 0
    const apply = (nextWidth: number) => {
      const w = Math.max(0, Math.floor(nextWidth))
      setWidth(prev => (prev === w ? prev : w))
    }

    const ro = new ResizeObserver(entries => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        apply(entries[0]?.contentRect.width ?? 0)
      })
    })

    ro.observe(el)
    apply(el.getBoundingClientRect().width)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [])

  return { ref, width }
}
