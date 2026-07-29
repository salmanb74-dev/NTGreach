'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import { hasCsAccess, isCsManager } from '@/lib/roles'
import { monthRangeUtc, type TimeLog } from '@/lib/support/time'

async function requireCsUser() {
  const profile = await getCachedProfile()
  if (!hasCsAccess(profile)) throw new Error('Not authorized')
  return profile!
}

export async function getActiveClockIn(userId: string): Promise<TimeLog | null> {
  const profile = await requireCsUser()
  // Reps may only query themselves; managers/admins can query anyone
  if (!isCsManager(profile) && userId !== profile.id) {
    throw new Error('Not authorized')
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('support_time_logs')
    .select('id, agent_id, clock_in, clock_out, notes, created_at')
    .eq('agent_id', userId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as TimeLog | null) ?? null
}

export async function clockIn(): Promise<TimeLog> {
  const profile = await requireCsUser()
  const supabase = createClient()

  const { data: openLog } = await supabase
    .from('support_time_logs')
    .select('id')
    .eq('agent_id', profile.id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle()

  if (openLog) {
    throw new Error('You are already clocked in')
  }

  const { data, error } = await supabase
    .from('support_time_logs')
    .insert({
      agent_id: profile.id,
      clock_in: new Date().toISOString(),
    })
    .select('id, agent_id, clock_in, clock_out, notes, created_at')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/support/time')
  return data as TimeLog
}

export async function clockOut(id: string, notes?: string): Promise<TimeLog> {
  const profile = await requireCsUser()
  const supabase = createClient()

  const { data: row, error: fetchError } = await supabase
    .from('support_time_logs')
    .select('id, agent_id, clock_out')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!row) throw new Error('Time log not found')
  if (row.agent_id !== profile.id) throw new Error('You can only clock out your own session')
  if (row.clock_out) throw new Error('This session is already clocked out')

  const { data, error } = await supabase
    .from('support_time_logs')
    .update({
      clock_out: new Date().toISOString(),
      notes:     notes?.trim() || null,
    })
    .eq('id', id)
    .select('id, agent_id, clock_in, clock_out, notes, created_at')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/support/time')
  return data as TimeLog
}

export async function getTimeLogs(
  userId: string,
  month: number,
  year: number
): Promise<TimeLog[]> {
  const profile = await requireCsUser()
  if (!isCsManager(profile) && userId !== profile.id) {
    throw new Error('Not authorized')
  }

  const { startIso, endIso } = monthRangeUtc(year, month)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('support_time_logs')
    .select('id, agent_id, clock_in, clock_out, notes, created_at')
    .eq('agent_id', userId)
    .gte('clock_in', startIso)
    .lte('clock_in', endIso)
    .order('clock_in', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TimeLog[]
}
