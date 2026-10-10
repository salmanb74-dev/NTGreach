'use server'

import { assertNoError } from '@/lib/assert'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin } from '@/lib/roles'
import {
  parseSupportProduct,
  type SupportProduct,
} from '@/lib/support/product'
import {
  DEFAULT_OFFLINE_MESSAGE,
  MAX_RECURRING_SHIFTS,
  agentDisplayName,
  shiftLocalWeekday,
  shiftStartDateYmd,
  shiftTimePatternKey,
  type OnDutyAgent,
  type ShiftChangeUndo,
  type ShiftCountRow,
  type ShiftRowSnapshot,
} from '@/lib/support/shifts'

const SHIFT_ROW_COLS =
  'id, agent_id, start_at, end_at, created_by, created_at, series_id, product' as const

function requireProduct(product: string): SupportProduct {
  return parseSupportProduct(product)
}

async function fetchShiftRowsByIds(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
): Promise<ShiftRowSnapshot[]> {
  if (ids.length === 0) return []
  const rows: ShiftRowSnapshot[] = []
  const chunkSize = 100
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .select(SHIFT_ROW_COLS)
      .in('id', chunk)
    assertNoError(error)
    rows.push(...((data ?? []) as ShiftRowSnapshot[]))
  }
  return rows
}

async function requireCsAdmin() {
  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) throw new Error('Only CS admins can manage shifts')
  return profile!
}

export async function createShift(
  agentId: string,
  startAt: string,
  endAt: string,
  productInput: string
): Promise<{ undo: ShiftChangeUndo }> {
  const profile = await requireCsAdmin()
  const product = requireProduct(productInput)
  const supabase = createClient()

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date/time')
  }
  if (end <= start) throw new Error('End time must be after start time')

  const { data, error } = await supabase
    .from('support_shifts')
    .insert({
      agent_id:   agentId,
      start_at:   start.toISOString(),
      end_at:     end.toISOString(),
      created_by: profile.id,
      product,
    })
    .select('id')
    .single()
  assertNoError(error)
  if (!data?.id) throw new Error('Failed to create shift')

  revalidatePath('/support/calendar')
  return {
    undo: {
      kind:  'create',
      label: 'Added 1 shift',
      ids:   [data.id],
    },
  }
}

export async function createRecurringShifts(
  agentId: string,
  shifts: { startAt: string; endAt: string }[],
  productInput: string
): Promise<{ created: number; seriesId: string; undo: ShiftChangeUndo }> {
  const profile = await requireCsAdmin()
  const product = requireProduct(productInput)
  const supabase = createClient()

  if (!agentId) throw new Error('Select an agent')
  if (!shifts.length) throw new Error('No shifts to create — check weekdays and date range')
  if (shifts.length > MAX_RECURRING_SHIFTS) {
    throw new Error(
      `Too many shifts (max ${MAX_RECURRING_SHIFTS}). Shorten the range or fewer weekdays.`
    )
  }

  const seriesId = crypto.randomUUID()

  const rows = shifts.map(s => {
    const start = new Date(s.startAt)
    const end = new Date(s.endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date/time in series')
    }
    if (end <= start) throw new Error('Each shift end must be after start')
    return {
      agent_id:   agentId,
      start_at:   start.toISOString(),
      end_at:     end.toISOString(),
      created_by: profile.id,
      series_id:  seriesId,
      product,
    }
  })

  const createdIds: string[] = []
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .insert(chunk)
      .select('id')
    assertNoError(error)
    for (const row of data ?? []) createdIds.push(row.id)
  }

  revalidatePath('/support/calendar')
  return {
    created:  createdIds.length,
    seriesId,
    undo: {
      kind:  'create',
      label: `Added ${createdIds.length} shift${createdIds.length === 1 ? '' : 's'}`,
      ids:   createdIds,
    },
  }
}

/** Delete every shift in a recurring series. */
export async function deleteShiftSeries(seriesId: string): Promise<{ deleted: number }> {
  await requireCsAdmin()
  const supabase = createClient()
  if (!seriesId) throw new Error('Missing series id')

  const { data, error } = await supabase
    .from('support_shifts')
    .delete()
    .eq('series_id', seriesId)
    .select('id')

  assertNoError(error)
  revalidatePath('/support/calendar')
  return { deleted: data?.length ?? 0 }
}

/**
 * Delete shifts for an agent that share the same start/end clock pattern.
 * scope:
 *  - 'from_here' → this shift and later (by start_at)
 *  - 'all' → past and future matching times
 * sameWeekdayOnly: when true, only the same local weekday (e.g. Tuesdays).
 */
export async function deleteMatchingShifts(
  shiftId: string,
  scope: 'from_here' | 'all' = 'from_here',
  sameWeekdayOnly = true
): Promise<{ deleted: number; undo: ShiftChangeUndo | null }> {
  await requireCsAdmin()
  const supabase = createClient()

  const { data: origin, error: fetchError } = await supabase
    .from('support_shifts')
    .select(SHIFT_ROW_COLS)
    .eq('id', shiftId)
    .maybeSingle()

  assertNoError(fetchError)
  if (!origin) throw new Error('Shift not found')

  const originWeekday = shiftLocalWeekday(origin.start_at)
  const originStartMs = new Date(origin.start_at).getTime()
  const pattern = shiftTimePatternKey(origin.start_at, origin.end_at)

  let candidates: ShiftRowSnapshot[]

  const originProduct = requireProduct(String(origin.product ?? 'resto'))

  if (origin.series_id) {
    const { data, error } = await supabase
      .from('support_shifts')
      .select(SHIFT_ROW_COLS)
      .eq('series_id', origin.series_id)
      .eq('product', originProduct)
    assertNoError(error)
    candidates = (data ?? []) as ShiftRowSnapshot[]
  } else {
    const { data, error } = await supabase
      .from('support_shifts')
      .select(SHIFT_ROW_COLS)
      .eq('agent_id', origin.agent_id)
      .eq('product', originProduct)
    assertNoError(error)
    candidates = ((data ?? []) as ShiftRowSnapshot[]).filter(
      s => shiftTimePatternKey(s.start_at, s.end_at) === pattern
    )
  }

  const rows = candidates.filter(s => {
    if (sameWeekdayOnly && shiftLocalWeekday(s.start_at) !== originWeekday) {
      return false
    }
    if (scope === 'from_here' && new Date(s.start_at).getTime() < originStartMs) {
      return false
    }
    return true
  })

  const ids = rows.map(s => s.id)
  if (ids.length === 0) return { deleted: 0, undo: null }

  const chunkSize = 100
  let deleted = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .delete()
      .in('id', chunk)
      .select('id')
    assertNoError(error)
    deleted += data?.length ?? 0
  }

  revalidatePath('/support/calendar')
  return {
    deleted,
    undo: {
      kind:  'delete',
      label: `Deleted ${deleted} shift${deleted === 1 ? '' : 's'}`,
      rows,
    },
  }
}

/** Transfer a shift to another agent. */
export async function updateShift(id: string, agentId: string) {
  await requireCsAdmin()
  const supabase = createClient()

  if (!agentId) throw new Error('Select an agent')

  const { error } = await supabase
    .from('support_shifts')
    .update({ agent_id: agentId, series_id: null })
    .eq('id', id)

  assertNoError(error)
  revalidatePath('/support/calendar')
}

/**
 * Transfer one or matching shifts to another agent.
 * scope:
 *  - 'one' → only this shift (detached from series)
 *  - 'from_here' → this day and future
 *  - 'all' → past and future matching
 * sameWeekdayOnly: when true, only the same local weekday (e.g. Tuesdays).
 */
export async function transferMatchingShifts(
  shiftId: string,
  agentId: string,
  scope: 'one' | 'from_here' | 'all' = 'one',
  sameWeekdayOnly = true
): Promise<{ transferred: number; undo: ShiftChangeUndo | null }> {
  await requireCsAdmin()
  const supabase = createClient()

  if (!agentId) throw new Error('Select an agent')

  const { data: origin, error: fetchError } = await supabase
    .from('support_shifts')
    .select('id, agent_id, start_at, end_at, series_id, product')
    .eq('id', shiftId)
    .maybeSingle()

  assertNoError(fetchError)
  if (!origin) throw new Error('Shift not found')
  if (origin.agent_id === agentId) throw new Error('Already assigned to that agent')

  const originProduct = requireProduct(String(origin.product ?? 'resto'))

  if (scope === 'one') {
    const before = [
      {
        id:        origin.id,
        agent_id:  origin.agent_id,
        series_id: origin.series_id as string | null,
      },
    ]
    const { error } = await supabase
      .from('support_shifts')
      .update({ agent_id: agentId, series_id: null })
      .eq('id', shiftId)
    assertNoError(error)
    revalidatePath('/support/calendar')
    return {
      transferred: 1,
      undo: {
        kind:  'transfer',
        label: 'Transferred 1 shift',
        before,
      },
    }
  }

  const originWeekday = shiftLocalWeekday(origin.start_at)
  const originStartMs = new Date(origin.start_at).getTime()
  const pattern = shiftTimePatternKey(origin.start_at, origin.end_at)

  let candidates: { id: string; start_at: string; end_at: string; agent_id: string; series_id: string | null }[]

  if (origin.series_id) {
    const { data, error } = await supabase
      .from('support_shifts')
      .select('id, start_at, end_at, agent_id, series_id')
      .eq('series_id', origin.series_id)
      .eq('product', originProduct)
    assertNoError(error)
    candidates = data ?? []
  } else {
    const { data, error } = await supabase
      .from('support_shifts')
      .select('id, start_at, end_at, agent_id, series_id')
      .eq('agent_id', origin.agent_id)
      .eq('product', originProduct)
    assertNoError(error)
    candidates = (data ?? []).filter(
      s => shiftTimePatternKey(s.start_at, s.end_at) === pattern
    )
  }

  const targets = candidates.filter(s => {
    if (sameWeekdayOnly && shiftLocalWeekday(s.start_at) !== originWeekday) {
      return false
    }
    if (scope === 'from_here' && new Date(s.start_at).getTime() < originStartMs) {
      return false
    }
    return true
  })

  const ids = targets.map(s => s.id)
  if (ids.length === 0) return { transferred: 0, undo: null }

  const before = targets.map(s => ({
    id:        s.id,
    agent_id:  s.agent_id,
    series_id: s.series_id,
  }))

  // Partial move (weekday-only or from_here) gets its own series under the new agent.
  // Full series + all weekdays keeps the existing series_id.
  const keepSeries =
    Boolean(origin.series_id) &&
    scope === 'all' &&
    !sameWeekdayOnly

  const patch = keepSeries
    ? { agent_id: agentId }
    : { agent_id: agentId, series_id: crypto.randomUUID() }

  const chunkSize = 100
  let transferred = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .update(patch)
      .in('id', chunk)
      .select('id')
    assertNoError(error)
    transferred += data?.length ?? 0
  }

  revalidatePath('/support/calendar')
  return {
    transferred,
    undo: {
      kind:  'transfer',
      label: `Transferred ${transferred} shift${transferred === 1 ? '' : 's'}`,
      before,
    },
  }
}

export async function deleteShift(
  id: string
): Promise<{ undo: ShiftChangeUndo | null }> {
  await requireCsAdmin()
  const supabase = createClient()

  const rows = await fetchShiftRowsByIds(supabase, [id])
  if (rows.length === 0) throw new Error('Shift not found')

  const { error } = await supabase.from('support_shifts').delete().eq('id', id)
  assertNoError(error)
  revalidatePath('/support/calendar')
  return {
    undo: {
      kind:  'delete',
      label: 'Deleted 1 shift',
      rows,
    },
  }
}

/** Reverse the last add, transfer, or delete using its undo payload. */
export async function undoShiftChange(
  undo: ShiftChangeUndo
): Promise<{ restored: number }> {
  await requireCsAdmin()
  const supabase = createClient()

  if (!undo || !['create', 'transfer', 'delete'].includes(undo.kind)) {
    throw new Error('Nothing to undo')
  }

  if (undo.kind === 'create') {
    if (!undo.ids?.length) throw new Error('Nothing to undo')
    let restored = 0
    const chunkSize = 100
    for (let i = 0; i < undo.ids.length; i += chunkSize) {
      const chunk = undo.ids.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from('support_shifts')
        .delete()
        .in('id', chunk)
        .select('id')
      assertNoError(error)
      restored += data?.length ?? 0
    }
    revalidatePath('/support/calendar')
    return { restored }
  }

  if (undo.kind === 'transfer') {
    if (!undo.before?.length) throw new Error('Nothing to undo')
    let restored = 0
    const chunkSize = 50
    for (let i = 0; i < undo.before.length; i += chunkSize) {
      const chunk = undo.before.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async row => {
          const { error } = await supabase
            .from('support_shifts')
            .update({ agent_id: row.agent_id, series_id: row.series_id })
            .eq('id', row.id)
          assertNoError(error)
          restored += 1
        })
      )
    }
    revalidatePath('/support/calendar')
    return { restored }
  }

  if (!undo.rows?.length) throw new Error('Nothing to undo')
  const chunkSize = 100
  let restored = 0
  for (let i = 0; i < undo.rows.length; i += chunkSize) {
    const chunk = undo.rows.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .insert(chunk)
      .select('id')
    assertNoError(error)
    restored += data?.length ?? 0
  }

  revalidatePath('/support/calendar')
  return { restored }
}

/**
 * Count shifts per agent whose start day (Asia/Karachi) falls in [startYmd, endYmd] inclusive.
 */
export async function countShiftsByAgent(
  startYmd: string,
  endYmd: string,
  productInput: string
): Promise<{ rows: ShiftCountRow[]; total: number; start: string; end: string }> {
  await requireCsAdmin()
  const product = requireProduct(productInput)
  const supabase = createClient()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
    throw new Error('Invalid date range')
  }
  if (endYmd < startYmd) throw new Error('End date must be on or after start date')

  // Pad query window so PK calendar days near midnight are not missed in UTC storage
  const queryStart = new Date(`${startYmd}T00:00:00+05:00`)
  queryStart.setUTCDate(queryStart.getUTCDate() - 1)
  const queryEnd = new Date(`${endYmd}T23:59:59.999+05:00`)
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 1)

  const { data, error } = await supabase
    .from('support_shifts')
    .select('agent_id, start_at')
    .eq('product', product)
    .gte('start_at', queryStart.toISOString())
    .lte('start_at', queryEnd.toISOString())

  assertNoError(error)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const day = shiftStartDateYmd(row.start_at)
    if (day < startYmd || day > endYmd) continue
    counts.set(row.agent_id, (counts.get(row.agent_id) ?? 0) + 1)
  }

  const agentIds = [...counts.keys()]
  const nameById = new Map<string, string>()
  if (agentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', agentIds)
    for (const p of profiles ?? []) {
      nameById.set(p.id, agentDisplayName(p))
    }
  }

  const rows: ShiftCountRow[] = agentIds
    .map(id => ({
      agent_id:   id,
      agent_name: nameById.get(id) ?? 'Agent',
      count:      counts.get(id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.agent_name.localeCompare(b.agent_name))

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return { rows, total, start: startYmd, end: endYmd }
}

/** Agent whose shift covers "now" for a product, or null if coverage gap. */
export async function getCurrentOnDuty(
  productInput: string = 'resto'
): Promise<OnDutyAgent | null> {
  const product = requireProduct(productInput)
  const supabase = createClient()
  const now = new Date().toISOString()

  const { data: shift, error } = await supabase
    .from('support_shifts')
    .select('id, agent_id, start_at, end_at')
    .eq('product', product)
    .lte('start_at', now)
    .gte('end_at', now)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  assertNoError(error)
  if (!shift) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', shift.agent_id)
    .maybeSingle()

  return {
    shift_id:   shift.id,
    agent_id:   shift.agent_id,
    agent_name: profile?.full_name?.trim() || profile?.email || 'Agent',
    start_at:   shift.start_at,
    end_at:     shift.end_at,
  }
}

export async function getSupportOfflineMessage(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'support_offline_message')
    .maybeSingle()

  const value = data?.value?.trim()
  return value || DEFAULT_OFFLINE_MESSAGE
}

export async function updateSupportOfflineMessage(message: string) {
  await requireCsAdmin()
  const supabase = createClient()
  const value = message.trim() || DEFAULT_OFFLINE_MESSAGE

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key:        'support_offline_message',
      value,
      updated_at: new Date().toISOString(),
    })

  assertNoError(error)
  revalidatePath('/support/settings')
  revalidatePath('/support/chats')
}

/** Whether anyone is on duty right now (for chat offline banner). */
export async function getSupportCoverageState(
  productInput: string = 'resto'
): Promise<{
  onDuty: OnDutyAgent | null
  offlineMessage: string
}> {
  const product = requireProduct(productInput)
  const [onDuty, offlineMessage] = await Promise.all([
    getCurrentOnDuty(product),
    getSupportOfflineMessage(),
  ])
  return { onDuty, offlineMessage }
}
