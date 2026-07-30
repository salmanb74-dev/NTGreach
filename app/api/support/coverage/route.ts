import { NextRequest, NextResponse } from 'next/server'
import {
  assertSupportApiKey,
  getSupportAdmin,
  supportApiError,
} from '@/lib/support/api'

const DEFAULT_OFFLINE_MESSAGE =
  'Our support team is currently offline. We will get back to you as soon as possible.'

export async function GET(request: NextRequest) {
  const authError = assertSupportApiKey(request)
  if (authError) return authError

  try {
    const admin = getSupportAdmin()
    const now = new Date().toISOString()

    const [{ data: shift }, { data: setting }] = await Promise.all([
      admin
        .from('support_shifts')
        .select('id')
        .lte('start_at', now)
        .gte('end_at', now)
        .limit(1)
        .maybeSingle(),
      admin
        .from('app_settings')
        .select('value')
        .eq('key', 'support_offline_message')
        .maybeSingle(),
    ])

    const offlineMessage = setting?.value?.trim() || DEFAULT_OFFLINE_MESSAGE

    return NextResponse.json({
      on_duty: Boolean(shift),
      offline_message: offlineMessage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
