import { redirect } from 'next/navigation'

export default function OpsTenantsRedirect({
  searchParams,
}: {
  searchParams: { env?: string }
}) {
  const env = searchParams.env ? `?env=${encodeURIComponent(searchParams.env)}` : ''
  redirect(`/ops/management${env}`)
}
