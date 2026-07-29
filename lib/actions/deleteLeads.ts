'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteLeads(ids: string[]): Promise<void> {
  if (!ids.length) return
  const supabase = createClient()
  const { error } = await supabase
    .from('leads')
    .delete()
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/leads')
}
