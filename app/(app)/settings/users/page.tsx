import { redirect } from 'next/navigation'

/** Users moved to platform Ops module under /ops/users. */
export default function SettingsUsersRedirect() {
  redirect('/ops/users')
}
