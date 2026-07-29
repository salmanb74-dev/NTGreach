import type { Lead } from '@/lib/types'
import { STAGE_LABELS, SOURCE_LABELS } from '@/lib/types'

export function exportLeadsToExcel(leads: Lead[]) {
  // Dynamic import to avoid SSR issues
  return import('xlsx').then(XLSX => {
    const rows = leads.map(lead => ({
      'Contact Name':     lead.contact_name,
      'Company':          lead.company_name,
      'Email':            lead.email ?? '',
      'Phone':            lead.phone ?? '',
      'City':             lead.city ?? '',
      'Restaurant Type':  lead.restaurant_type ?? '',
      'Source':           lead.source ? SOURCE_LABELS[lead.source] : '',
      'Stage':            STAGE_LABELS[lead.stage],
      'Notes':            lead.notes ?? '',
      'Created':          new Date(lead.created_at).toLocaleDateString('en-GB'),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')

    // Column widths
    ws['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 28 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
      { wch: 35 }, { wch: 12 },
    ]

    XLSX.writeFile(wb, `NTG-Reach-Leads-${new Date().toISOString().slice(0, 10)}.xlsx`)
  })
}
