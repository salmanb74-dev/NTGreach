import { NextRequest, NextResponse } from 'next/server'
import {
  assertAnySupportApiKey,
  getSupportAdmin,
  requireTenantId,
  supportApiError,
} from '@/lib/support/api'

function monthKeyKarachi(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso))
}

function currentMonthKey() {
  return monthKeyKarachi(new Date().toISOString())
}

function parseMonth(value: string | null) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value
  return currentMonthKey()
}

export async function GET(request: NextRequest) {
  const authResult = assertAnySupportApiKey(request)
  if (authResult instanceof NextResponse) return authResult
  const keyProduct = authResult.product

  const tenantId = requireTenantId(request.nextUrl.searchParams.get('tenant_id'))
  if (!tenantId) return supportApiError('tenant_id is required')

  const month = parseMonth(request.nextUrl.searchParams.get('month'))

  try {
    const admin = getSupportAdmin()
    const { data, error } = await admin
      .from('support_conversations')
      .select('id, created_at, support_category, logged_minutes')
      .eq('tenant_id', tenantId)
      .eq('product', keyProduct)
      .limit(5000)

    if (error) return supportApiError(error.message, 500)

    let platformMinutes = 0
    let operationalMinutes = 0
    let chatCount = 0

    for (const row of data ?? []) {
      if (monthKeyKarachi(String(row.created_at)) !== month) continue
      const minutes = Number(row.logged_minutes ?? 0) || 0
      if (minutes <= 0) continue

      chatCount += 1
      if (row.support_category === 'operational') operationalMinutes += minutes
      else platformMinutes += minutes
    }

    return NextResponse.json({
      tenant_id: tenantId,
      month,
      platform_minutes: platformMinutes,
      operational_minutes: operationalMinutes,
      chat_count: chatCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
