import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — one browser client / one Realtime socket for the whole app.
// Creating a new client per call breaks Realtime auth + subscriptions.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}

/** Pass the session JWT to Realtime so RLS can authorize postgres_changes. */
export async function ensureRealtimeAuth(client: SupabaseClient = createClient()) {
  const { data: { session } } = await client.auth.getSession()
  if (session?.access_token) {
    await client.realtime.setAuth(session.access_token)
  }
  return session
}
