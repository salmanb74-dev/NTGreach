import { NextResponse } from 'next/server'

export async function GET() {
  const XLSX = await import('xlsx')

  // Header row matching CRM fields
  const headers = [
    'Contact Name',
    'Company Name',
    'Email',
    'Phone',
    'City',
    'Restaurant Type',
    'Source',
    'Stage',
    'Notes',
  ]

  // One example row
  const example = [
    'Ahmed Tariq',
    'Spice Garden Restaurants',
    'ahmed@spice.pk',
    '+92 321 1234567',
    'Karachi',
    'Fast Food Chain',
    'cold_call',
    'new',
    'Has 3 branches, currently manual',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map(() => ({ wch: 22 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="ntg-reach-import-template.xlsx"',
    },
  })
}
