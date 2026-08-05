import { NextRequest, NextResponse } from 'next/server'
import {
  assertSupportApiKey,
  getSupportAdmin,
  supportApiError,
} from '@/lib/support/api'

const DEFAULT_OFFLINE_MESSAGE =
  'Our support team is currently offline. We will get back to you as soon as possible.'

const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000
const CONTIGUOUS_GAP_MS = 60_000

type ShiftRow = { start_at: string; end_at: string }

/** End of the continuous on-duty block that covers `now` (allows ≤1 min gaps). */
function continuousCoverageEnd(nowIso: string, shifts: ShiftRow[]): string | null {
  const covering = shifts.filter((s) => s.start_at <= nowIso && s.end_at >= nowIso)
  if (!covering.length) return null

  let endMs = Math.max(...covering.map((s) => new Date(s.end_at).getTime()))
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )

  for (const shift of sorted) {
    const startMs = new Date(shift.start_at).getTime()
    const shiftEndMs = new Date(shift.end_at).getTime()
    if (startMs <= endMs + CONTIGUOUS_GAP_MS && shiftEndMs > endMs) {
      endMs = shiftEndMs
    }
  }

  return new Date(endMs).toISOString()
}

function nextAvailableAt(nowIso: string, shifts: ShiftRow[]): string | null {
  const upcoming = shifts
    .filter((s) => s.start_at > nowIso)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  return upcoming[0]?.start_at ?? null
}

export async function GET(request: NextRequest) {
  const authError = assertSupportApiKey(request)
  if (authError) return authError

  try {
    const admin = getSupportAdmin()
    const now = new Date()
    const nowIso = now.toISOString()
    const horizonIso = new Date(now.getTime() + LOOKAHEAD_MS).toISOString()

    const [{ data: shifts }, { data: setting }] = await Promise.all([
      admin
        .from('support_shifts')
        .select('start_at, end_at')
        .lt('start_at', horizonIso)
        .gt('end_at', nowIso)
        .order('start_at', { ascending: true }),
      admin
        .from('app_settings')
        .select('value')
        .eq('key', 'support_offline_message')
        .maybeSingle(),
    ])

    const rows = (shifts ?? []) as ShiftRow[]
    const onDuty = rows.some((s) => s.start_at <= nowIso && s.end_at >= nowIso)
    const offlineMessage = setting?.value?.trim() || DEFAULT_OFFLINE_MESSAGE

    return NextResponse.json({
      on_duty: onDuty,
      offline_message: offlineMessage,
      next_available_at: onDuty ? null : nextAvailableAt(nowIso, rows),
      coverage_ends_at: onDuty ? continuousCoverageEnd(nowIso, rows) : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return supportApiError(message, 500)
  }
}
