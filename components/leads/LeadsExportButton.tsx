'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { exportLeadsToExcel } from '@/lib/exportLeads'
import type { Lead } from '@/lib/types'

interface Props {
  // Search params to replicate the current filter when exporting
  q?:     string
  stage?: string
}

export default function LeadsExportButton({ q, stage }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q)     params.set('q', q)
      if (stage && stage !== 'all') params.set('stage', stage)

      const res  = await fetch(`/api/leads/export?${params.toString()}`)
      const data = await res.json()
      exportLeadsToExcel(data.leads as Lead[])
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {loading ? 'Exporting…' : 'Export'}
    </Button>
  )
}
