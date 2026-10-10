'use client'

import { useEffect, useState } from 'react'
import { getSupportCoverageState } from '@/lib/actions/support-shifts'
import type { SupportProduct } from '@/lib/support/product'

/** Poll support shift coverage; returns offline banner text when no agent is on duty. */
export function useSupportCoverage(
  product: SupportProduct | null | undefined,
  pollMs = 60_000
) {
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!product) {
      setOfflineMessage(null)
      return
    }

    let cancelled = false

    async function loadCoverage() {
      try {
        const state = await getSupportCoverageState(product!)
        if (cancelled) return
        setOfflineMessage(state.onDuty ? null : state.offlineMessage)
      } catch {
        if (!cancelled) setOfflineMessage(null)
      }
    }

    void loadCoverage()
    const interval = setInterval(() => void loadCoverage(), pollMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [product, pollMs])

  return offlineMessage
}
