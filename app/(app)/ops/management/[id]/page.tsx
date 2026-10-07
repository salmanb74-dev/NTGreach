import { cookies } from 'next/headers'
import TenantDetailClient from '@/components/ops/TenantDetailClient'
import { isModule } from '@/lib/modules'
import { opsProductFromModule } from '@/lib/ops/product'
import { parseAlmaAdminEnv, parseAlmaTenantTab } from '@/lib/alma-admin/types'
import { parseRestoAdminEnv, parseTenantTab } from '@/lib/resto-admin/types'

export default function OpsManagementDetailPage({
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
  const tab =
    product === 'alma'
      ? parseAlmaTenantTab(searchParams.tab)
      : parseTenantTab(searchParams.tab)

  return (
    <TenantDetailClient
      tenantId={decodeURIComponent(params.id)}
      initialEnv={env}
      initialTab={tab}
    />
  )
}
