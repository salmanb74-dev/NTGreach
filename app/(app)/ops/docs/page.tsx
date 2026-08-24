import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedProfile } from '@/lib/dataCache'
import {
  hasPlatformOpsAccess,
  isPlatformOpsAdmin,
} from '@/lib/roles'
import OpsDocsClient from '@/components/ops/OpsDocsClient'
import type { OpsDoc, OpsEnumeration } from '@/lib/ops-docs/types'

export default async function OpsDocsPage() {
  const profile = await getCachedProfile()
  if (!hasPlatformOpsAccess(profile)) redirect('/ops')

  const supabase = createClient()
  const [{ data: docs }, { data: enums }] = await Promise.all([
    supabase
      .from('ops_docs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true }),
    supabase
      .from('ops_enumerations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const categories = ((enums ?? []) as OpsEnumeration[]).filter(
    e => e.category === 'doc_category'
  )
  const subcategories = ((enums ?? []) as OpsEnumeration[]).filter(
    e => e.category === 'doc_subcategory'
  )

  return (
    <OpsDocsClient
      docs={(docs ?? []) as OpsDoc[]}
      categories={categories}
      subcategories={subcategories}
      currentUserId={profile!.id}
      isAdmin={isPlatformOpsAdmin(profile)}
    />
  )
}
