import { redirect } from 'next/navigation'

export default function OpsTenantDetailRedirect({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { env?: string; tab?: string }
}) {
  const qs = new URLSearchParams()
  if (searchParams.env) qs.set('env', searchParams.env)
  if (searchParams.tab) qs.set('tab', searchParams.tab)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/ops/management/${params.id}${suffix}`)
}
