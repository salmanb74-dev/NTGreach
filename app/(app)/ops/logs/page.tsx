import { redirect } from 'next/navigation'

/** Global Logs moved into tenant detail. */
export default function OpsLogsRedirect() {
  redirect('/ops/management')
}
