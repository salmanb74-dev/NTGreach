import TenantsClient from '@/components/ops/TenantsClient'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

export default function OpsManagementPage({
  searchParams,
}: {
  searchParams: { env?: string }
}) {
  const env = parseRestoAdminEnv(searchParams.env)
  return <TenantsClient initialEnv={env} />
}
