import { redirect } from 'next/navigation'

/** Platform Ops home is the shared /ops landing. */
export default function PlatformHomePage() {
  redirect('/ops')
}
