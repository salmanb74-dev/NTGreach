'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createReminder(data: {
  lead_id?:      string | null
  activity_type?: string
  note:          string
  remind_at:     string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('reminders').insert({
    user_id:       user.id,
    lead_id:       data.lead_id ?? null,
    activity_type: data.activity_type ?? null,
    note:          data.note,
    remind_at:     data.remind_at,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/notifications')
}

export async function dismissReminder(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('reminders')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/notifications')
}

export async function deleteReminder(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/notifications')
}
