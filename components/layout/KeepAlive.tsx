'use client'

import { useEffect } from 'react'

export default function KeepAlive() {
  useEffect(() => {
    // Ping immediately on mount
    fetch('/api/ping').catch(() => {})

    // Then every 4 minutes to keep Netlify function warm
    const interval = setInterval(() => {
      fetch('/api/ping').catch(() => {})
    }, 4 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return null
}
