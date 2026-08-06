'use server'

import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import {
  encodeModuleRoleMap,
  type ModuleRoleMap,
} from '@/lib/platform/access-model'
import { isPlatformOpsAdmin } from '@/lib/roles'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMP_PASSWORD } from '@/lib/platform/constants'

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
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      roles,
      products,
      password_changed_at: now,
      updated_at: now,
    })
    .eq('id', id)

  if (profileError) {
    if (/updated_at|column/i.test(profileError.message)) {
      const { error: retry } = await admin
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          roles,
          products,
          password_changed_at: now,
        })
        .eq('id', id)
      if (retry) throw new Error(retry.message)
    } else {
      throw new Error(profileError.message)
    }
  }

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
  const payload = {
    full_name: fullName,
    roles,
    products,
    updated_at: now,
  }

  const admin = getServiceRoleClient()
  const { error } = await admin.from('profiles').update(payload).eq('id', userId)

  if (error) {
    if (/updated_at|column/i.test(error.message)) {
      const { error: retry } = await admin
        .from('profiles')
        .update({ full_name: fullName, roles, products })
        .eq('id', userId)
      if (retry) throw new Error(retry.message)
    } else {
      throw new Error(error.message)
    }
  }

  revalidatePath('/platform/users')
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
  const { error: profileError } = await admin
    .from('profiles')
    .update({ password_changed_at: now, updated_at: now })
    .eq('id', userId)

  if (profileError && /updated_at|column/i.test(profileError.message)) {
    await admin
      .from('profiles')
      .update({ password_changed_at: now })
      .eq('id', userId)
  }

  revalidatePath('/platform/users')
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

  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
}

/** Call when the signed-in user changes their own password successfully. */
export async function markOwnPasswordChanged(): Promise<void> {
  const profile = await getCachedProfile()
  if (!profile) return
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()
  const now = nowIso()
  const { error } = await supabase
    .from('profiles')
    .update({ password_changed_at: now, updated_at: now })
    .eq('id', profile.id)
  if (error && /updated_at|column/i.test(error.message)) {
    await supabase
      .from('profiles')
      .update({ password_changed_at: now })
      .eq('id', profile.id)
  }
}
