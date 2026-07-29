'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import { isCsAdmin } from '@/lib/roles'
import {
  DEFAULT_OFFLINE_MESSAGE,
  shiftTimePatternKey,
  type OnDutyAgent,
} from '@/lib/support/shifts'

async function requireCsAdmin() {
  const profile = await getCachedProfile()
  if (!isCsAdmin(profile)) throw new Error('Only CS admins can manage shifts')
  return profile!
}

export async function createShift(agentId: string, startAt: string, endAt: string) {
  const profile = await requireCsAdmin()
  const supabase = createClient()

  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date/time')
  }
  if (end <= start) throw new Error('End time must be after start time')

  const { error } = await supabase.from('support_shifts').insert({
    agent_id:   agentId,
    start_at:   start.toISOString(),
    end_at:     end.toISOString(),
    created_by: profile.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/support/calendar')
}

export async function createRecurringShifts(
  agentId: string,
  shifts: { startAt: string; endAt: string }[]
): Promise<{ created: number; seriesId: string }> {
  const profile = await requireCsAdmin()
  const supabase = createClient()

  if (!agentId) throw new Error('Select an agent')
  if (!shifts.length) throw new Error('No shifts to create — check weekdays and date range')
  if (shifts.length > 400) throw new Error('Too many shifts (max 400). Shorten the range.')

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
    }
  })

  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('support_shifts').insert(chunk)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/support/calendar')
  return { created: rows.length, seriesId }
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

  if (error) throw new Error(error.message)
  revalidatePath('/support/calendar')
  return { deleted: data?.length ?? 0 }
}

/**
 * Delete shifts for an agent that share the same start/end clock pattern.
 * scope:
 *  - 'from_here' → this shift and later (by start_at)
 *  - 'all' → past and future matching times
 */
export async function deleteMatchingShifts(
  shiftId: string,
  scope: 'from_here' | 'all' = 'from_here'
): Promise<{ deleted: number }> {
  await requireCsAdmin()
  const supabase = createClient()

  const { data: origin, error: fetchError } = await supabase
    .from('support_shifts')
    .select('id, agent_id, start_at, end_at, series_id')
    .eq('id', shiftId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!origin) throw new Error('Shift not found')

  // Linked series: delete by series_id (+ optional from-date filter)
  if (origin.series_id) {
    let query = supabase
      .from('support_shifts')
      .delete()
      .eq('series_id', origin.series_id)

    if (scope === 'from_here') {
      query = query.gte('start_at', origin.start_at)
    }

    const { data, error } = await query.select('id')
    if (error) throw new Error(error.message)
    revalidatePath('/support/calendar')
    return { deleted: data?.length ?? 0 }
  }

  const pattern = shiftTimePatternKey(origin.start_at, origin.end_at)
  const originStartMs = new Date(origin.start_at).getTime()

  const { data: agentShifts, error: listError } = await supabase
    .from('support_shifts')
    .select('id, start_at, end_at')
    .eq('agent_id', origin.agent_id)

  if (listError) throw new Error(listError.message)

  const ids = (agentShifts ?? [])
    .filter(s => {
      if (shiftTimePatternKey(s.start_at, s.end_at) !== pattern) return false
      if (scope === 'from_here' && new Date(s.start_at).getTime() < originStartMs) {
        return false
      }
      return true
    })
    .map(s => s.id)

  if (ids.length === 0) return { deleted: 0 }

  const chunkSize = 100
  let deleted = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('support_shifts')
      .delete()
      .in('id', chunk)
      .select('id')
    if (error) throw new Error(error.message)
    deleted += data?.length ?? 0
  }

  revalidatePath('/support/calendar')
  return { deleted }
}

/** Transfer a shift to another agent. */
export async function updateShift(id: string, agentId: string) {
  await requireCsAdmin()
  const supabase = createClient()

  const { error } = await supabase
    .from('support_shifts')
    .update({ agent_id: agentId })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/support/calendar')
}

export async function deleteShift(id: string) {
  await requireCsAdmin()
  const supabase = createClient()

  const { error } = await supabase.from('support_shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/support/calendar')
}

/** Agent whose shift covers "now", or null if coverage gap. */
export async function getCurrentOnDuty(): Promise<OnDutyAgent | null> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const { data: shift, error } = await supabase
    .from('support_shifts')
    .select('id, agent_id, start_at, end_at')
    .lte('start_at', now)
    .gte('end_at', now)
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
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

  if (error) throw new Error(error.message)
  revalidatePath('/support/settings')
  revalidatePath('/support/chats')
}

/** Whether anyone is on duty right now (for chat offline banner). */
export async function getSupportCoverageState(): Promise<{
  onDuty: OnDutyAgent | null
  offlineMessage: string
}> {
  const [onDuty, offlineMessage] = await Promise.all([
    getCurrentOnDuty(),
    getSupportOfflineMessage(),
  ])
  return { onDuty, offlineMessage }
}
