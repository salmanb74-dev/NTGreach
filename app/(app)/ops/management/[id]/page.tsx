import TenantDetailClient from '@/components/ops/TenantDetailClient'
import { parseRestoAdminEnv, parseTenantTab } from '@/lib/resto-admin/types'

export default function OpsManagementDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { env?: string; tab?: string }
}) {
  const env = parseRestoAdminEnv(searchParams.env)
  const tab = parseTenantTab(searchParams.tab)

  return (
    <TenantDetailClient
      tenantId={decodeURIComponent(params.id)}
      initialEnv={env}
      initialTab={tab}
    />
  )
}
