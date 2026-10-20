import { cookies } from 'next/headers'
import TenantDetailClient from '@/components/ops/TenantDetailClient'
import { getCachedProfile } from '@/lib/dataCache'
import { isModule } from '@/lib/modules'
import { opsProductFromModule } from '@/lib/ops/product'
import { parseAlmaAdminEnv, parseAlmaTenantTab } from '@/lib/alma-admin/types'
import { parseRestoAdminEnv, parseTenantTab } from '@/lib/resto-admin/types'
import { isOpsProductAdmin } from '@/lib/roles'

export default async function OpsManagementDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { env?: string; tab?: string }
}) {
  const mod = cookies().get('ntg-active-module')?.value
  const product =
    opsProductFromModule(isModule(mod ?? '') ? mod! : 'ops_resto') ?? 'resto'
  const env =
    product === 'alma'
      ? parseAlmaAdminEnv(searchParams.env)
      : parseRestoAdminEnv(searchParams.env)
  let tab =
    product === 'alma'
      ? parseAlmaTenantTab(searchParams.tab)
      : parseTenantTab(searchParams.tab)

  const profile = await getCachedProfile()
  const canManage = isOpsProductAdmin(profile, product)
  if (!canManage && tab === 'delete') {
    tab = 'overview'
  }

  return (
    <TenantDetailClient
      tenantId={decodeURIComponent(params.id)}
      initialEnv={env}
      initialTab={tab}
      canManage={canManage}
    />
  )
}
