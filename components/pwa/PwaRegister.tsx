'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    // Only register in production so Next.js HMR isn't disrupted in dev.
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — install prompt may still appear without SW on some desktops.
    })
  }, [])

  return null
}
