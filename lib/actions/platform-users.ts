'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCachedProfile } from '@/lib/dataCache'
import {
  encodeModuleRoleMap,
  type ModuleRoleMap,
} from '@/lib/platform/access-model'
import { DEFAULT_TEMP_PASSWORD } from '@/lib/platform/constants'
import { isPlatformOpsAdmin } from '@/lib/roles'
import { getServiceRoleClient } from '@/lib/supabase/admin'

async function requirePlatformOpsAdmin() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) {
    throw new Error('Forbidden: Ops Admin required')
  }
  return profile
}

function assertModuleRoles(moduleRoles: ModuleRoleMap) {
  const encoded = encodeModuleRoleMap(moduleRoles)
  if (!encoded.ok) throw new Error(encoded.error)
  return encoded
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Update profiles with graceful fallback when optional columns
 * (password_changed_at, updated_at) are not yet migrated on Supabase.
 */
async function updateProfileRow(
  client: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const attempts: Record<string, unknown>[] = [payload]

  if ('password_changed_at' in payload || 'updated_at' in payload) {
    const withoutUpdated = { ...payload }
    delete withoutUpdated.updated_at
    const withoutPwd = { ...payload }
    delete withoutPwd.password_changed_at
    const withoutBoth = { ...payload }
    delete withoutBoth.password_changed_at
    delete withoutBoth.updated_at
    attempts.push(withoutUpdated, withoutPwd, withoutBoth)
  }

  let lastError: string | null = null
  for (const attempt of attempts) {
    const { error } = await client
      .from('profiles')
      .update(attempt)
      .eq('id', userId)
    if (!error) return
    lastError = error.message
    if (!/column|schema cache|does not exist/i.test(error.message)) {
      throw new Error(error.message)
    }
  }
  throw new Error(
    lastError ??
      'Could not update profile. Run supabase/platform_ops_users.sql in the Supabase SQL Editor.'
  )
}

export type UpsertUserInput = {
  fullName: string
  email: string
  /** Per-module role matrix from Ops Users UI */
  moduleRoles: ModuleRoleMap
}

export async function createReachUser(input: UpsertUserInput): Promise<{ id: string }> {
  await requirePlatformOpsAdmin()

  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!email || !fullName) throw new Error('Name and email are required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')

  const { roles, products } = assertModuleRoles(input.moduleRoles)

  const admin = getServiceRoleClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) throw new Error(error.message)
  const id = data.user?.id
  if (!id) throw new Error('User create returned no id')

  const now = nowIso()
  await updateProfileRow(admin, id, {
    full_name: fullName,
    email,
    roles,
    products,
    password_changed_at: now,
    updated_at: now,
  })

  revalidatePath('/ops/users')
  revalidatePath('/platform/users')
  return { id }
}

export async function updateReachUser(
  userId: string,
  input: {
    fullName: string
    moduleRoles: ModuleRoleMap
  }
): Promise<void> {
  await requirePlatformOpsAdmin()
  if (!userId) throw new Error('Missing user id')

  const fullName = input.fullName.trim()
  if (!fullName) throw new Error('Name is required')

  const { roles, products } = assertModuleRoles(input.moduleRoles)
  const now = nowIso()
  const admin = getServiceRoleClient()
  await updateProfileRow(admin, userId, {
    full_name: fullName,
    roles,
    products,
    updated_at: now,
  })

  revalidatePath('/ops/users')
  revalidatePath('/platform/users')
  revalidatePath(`/ops/users/${userId}`)
  revalidatePath(`/platform/users/${userId}`)
}

/** Reset password to DEFAULT_TEMP_PASSWORD (Admin only). */
export async function resetReachUserPassword(userId: string): Promise<void> {
  await requirePlatformOpsAdmin()
  if (!userId) throw new Error('Missing user id')

  const admin = getServiceRoleClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: DEFAULT_TEMP_PASSWORD,
  })
  if (error) throw new Error(error.message)

  const now = nowIso()
  try {
    await updateProfileRow(admin, userId, {
      password_changed_at: now,
      updated_at: now,
    })
  } catch {
    // Auth password was reset; optional profile columns may be missing
  }

  revalidatePath('/ops/users')
  revalidatePath('/platform/users')
  revalidatePath(`/ops/users/${userId}`)
  revalidatePath(`/platform/users/${userId}`)
}

/** Permanently delete auth user + profile (Admin only). Cannot delete yourself. */
export async function deleteReachUser(userId: string): Promise<void> {
  const me = await requirePlatformOpsAdmin()
  if (!userId) throw new Error('Missing user id')
  if (!me || me.id === userId) {
    throw new Error(
      !me ? 'Forbidden: Ops Admin required' : 'You cannot delete your own account'
    )
  }

  const admin = getServiceRoleClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/ops/users')
  revalidatePath('/platform/users')
  revalidatePath(`/ops/users/${userId}`)
  revalidatePath(`/platform/users/${userId}`)
}

/** Call when the signed-in user changes their own password successfully. */
export async function markOwnPasswordChanged(): Promise<void> {
  const profile = await getCachedProfile()
  if (!profile) return
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()
  const now = nowIso()
  try {
    await updateProfileRow(supabase, profile.id, {
      password_changed_at: now,
      updated_at: now,
    })
  } catch {
    // optional columns
  }
}
