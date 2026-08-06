import LogsClient from '@/components/ops/LogsClient'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

export default function OpsLogsPage({
  searchParams,
}: {
  searchParams: {
    env?: string
    tenantId?: string
    actionType?: string
    method?: string
    statusCode?: string
  }
}) {
  const env = parseRestoAdminEnv(searchParams.env)
  return (
    <LogsClient
      initialEnv={env}
      initialTenantId={searchParams.tenantId ?? ''}
      initialActionType={searchParams.actionType ?? ''}
    />
  )
}
