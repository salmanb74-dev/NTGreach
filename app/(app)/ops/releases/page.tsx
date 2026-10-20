import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ReleaseNotesClient from '@/components/ops/ReleaseNotesClient'
import { getCachedProfile } from '@/lib/dataCache'
import { isModule } from '@/lib/modules'
import { opsProductFromModule } from '@/lib/ops/product'
import type { OpsReleaseNote } from '@/lib/ops-release-notes/types'
import { hasOpsProductAccess, isOpsProductAdmin } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function OpsReleasesPage() {
  const mod = cookies().get('ntg-active-module')?.value
  const product =
    opsProductFromModule(isModule(mod ?? '') ? mod! : 'ops_resto') ?? 'resto'

  const profile = await getCachedProfile()
  if (!hasOpsProductAccess(profile, product)) {
    redirect('/ops')
  }

  const supabase = createClient()
  const { data } = await supabase
    .from('ops_release_notes')
    .select('*')
    .eq('product', product)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })

  return (
    <ReleaseNotesClient
      product={product}
      notes={(data ?? []) as OpsReleaseNote[]}
      canEdit={isOpsProductAdmin(profile, product)}
    />
  )
}
