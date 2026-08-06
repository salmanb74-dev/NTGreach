import type { PlatformUserRow } from '@/components/platform/types'
import type { UserRole } from '@/lib/roles'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string
  roles?: string[] | null
  products?: string[] | null
  password_changed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const SELECTS = [
  'id, full_name, email, roles, products, password_changed_at, created_at, updated_at',
  'id, full_name, email, roles, products, password_changed_at, created_at',
  'id, full_name, email, roles, products, created_at',
  'id, full_name, email, roles, created_at',
  'id, full_name, email, roles',
  'id, full_name, email',
]

function mapRow(row: ProfileRow): PlatformUserRow {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    roles: (row.roles ?? []) as UserRole[],
    products: row.products ?? [],
    password_changed_at: row.password_changed_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

function getClient() {
  try {
    return getServiceRoleClient()
  } catch {
    return createClient()
  }
}

/** Load all profiles for platform Ops Users (service role preferred). */
export async function fetchPlatformProfiles(): Promise<{
  users: PlatformUserRow[]
  error: string | null
}> {
  const client = getClient()
  let lastError: string | null = null

  for (const select of SELECTS) {
    const { data, error } = await client
      .from('profiles')
      .select(select)
      .order('full_name', { ascending: true })

    if (!error) {
      return {
        users: ((data ?? []) as unknown as ProfileRow[]).map(mapRow),
        error: null,
      }
    }

    lastError = error.message
    if (!/column|does not exist|Could not find/i.test(error.message)) break
  }

  return { users: [], error: lastError ?? 'Could not load profiles' }
}

/** Load one profile by id for platform Ops User detail. */
export async function fetchPlatformProfileById(
  id: string
): Promise<{ user: PlatformUserRow | null; error: string | null }> {
  const client = getClient()
  let lastError: string | null = null

  for (const select of SELECTS) {
    const { data, error } = await client
      .from('profiles')
      .select(select)
      .eq('id', id)
      .maybeSingle()

    if (!error) {
      if (!data) return { user: null, error: null }
      return { user: mapRow(data as unknown as ProfileRow), error: null }
    }

    lastError = error.message
    if (!/column|does not exist|Could not find/i.test(error.message)) break
  }

  return { user: null, error: lastError ?? 'Could not load profile' }
}
