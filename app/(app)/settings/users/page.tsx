import { redirect } from 'next/navigation'

/** Users moved to platform Ops module. */
export default function SettingsUsersRedirect() {
  redirect('/platform/users')
}
