import { cookies } from 'next/headers'
import TenantsClient from '@/components/ops/TenantsClient'
import { isModule } from '@/lib/modules'
import { opsProductFromModule } from '@/lib/ops/product'
import { parseAlmaAdminEnv } from '@/lib/alma-admin/types'
import { parseRestoAdminEnv } from '@/lib/resto-admin/types'

export default function OpsManagementPage({
  searchParams,
}: {
  searchParams: { env?: string }
}) {
  const mod = cookies().get('ntg-active-module')?.value
  const product =
    opsProductFromModule(isModule(mod ?? '') ? mod! : 'ops_resto') ?? 'resto'
  const env =
    product === 'alma'
      ? parseAlmaAdminEnv(searchParams.env)
      : parseRestoAdminEnv(searchParams.env)

  return <TenantsClient initialEnv={env} />
}
