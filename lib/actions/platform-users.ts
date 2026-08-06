'use server'

import { revalidatePath } from 'next/cache'
import { getCachedProfile } from '@/lib/dataCache'
import {
  isPlatformOpsAdmin,
  type Product,
  type UserRole,
} from '@/lib/roles'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const DEFAULT_TEMP_PASSWORD = '12345678'

const ALL_ROLES: UserRole[] = [
  'crm_admin',
  'crm_manager',
  'crm_sales_rep',
  'cs_admin',
  'cs_manager',
  'cs_support_rep',
  'ops_admin',
  'ops_user',
]

const ALL_PRODUCTS: Product[] = ['resto', 'alma']

function sanitizeRoles(roles: string[]): UserRole[] {
  const unique = Array.from(new Set(roles)).filter((r): r is UserRole =>
    ALL_ROLES.includes(r as UserRole)
  )
  // Prefer a single platform Ops role (Admin wins over User)
  const hasAdmin = unique.includes('ops_admin')
  const hasUser = unique.includes('ops_user')
  if (hasAdmin && hasUser) {
    return unique.filter(r => r !== 'ops_user')
  }
  return unique
}

function sanitizeProducts(products: string[]): Product[] {
  return Array.from(new Set(products)).filter((p): p is Product =>
    ALL_PRODUCTS.includes(p as Product)
  )
}

async function requirePlatformOpsAdmin() {
  const profile = await getCachedProfile()
  if (!isPlatformOpsAdmin(profile)) {
    throw new Error('Forbidden: Ops Admin required')
  }
  return profile
}

export type UpsertUserInput = {
  fullName: string
  email: string
  roles: UserRole[]
  products: Product[]
}

export async function createReachUser(input: UpsertUserInput): Promise<{ id: string }> {
  await requirePlatformOpsAdmin()

  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!email || !fullName) throw new Error('Name and email are required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')

  const roles = sanitizeRoles(input.roles)
  const products = sanitizeProducts(input.products)
  if (roles.length === 0) {
    throw new Error('Select at least one role')
  }

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

  const now = new Date().toISOString()
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      roles,
      products,
      password_changed_at: now,
    })
    .eq('id', id)

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/platform/users')
  return { id }
}

export async function updateReachUser(
  userId: string,
  input: {
    fullName: string
    roles: UserRole[]
    products: Product[]
  }
): Promise<void> {
  await requirePlatformOpsAdmin()
  if (!userId) throw new Error('Missing user id')

  const fullName = input.fullName.trim()
  if (!fullName) throw new Error('Name is required')

  const roles = sanitizeRoles(input.roles)
  const products = sanitizeProducts(input.products)
  if (roles.length === 0) throw new Error('Select at least one role')

  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      roles,
      products,
    })
    .eq('id', userId)

  if (error) {
    // Fallback to service role if RLS not migrated yet
    const admin = getServiceRoleClient()
    const { error: adminError } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        roles,
        products,
      })
      .eq('id', userId)
    if (adminError) throw new Error(adminError.message)
  }

  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
}

/** Reset password to the default temp password (Admin only). */
export async function resetReachUserPassword(userId: string): Promise<void> {
  await requirePlatformOpsAdmin()
  if (!userId) throw new Error('Missing user id')

  const admin = getServiceRoleClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: DEFAULT_TEMP_PASSWORD,
  })
  if (error) throw new Error(error.message)

  const now = new Date().toISOString()
  await admin
    .from('profiles')
    .update({ password_changed_at: now })
    .eq('id', userId)

  revalidatePath('/platform/users')
  revalidatePath(`/platform/users/${userId}`)
}

/** Call when the signed-in user changes their own password successfully. */
export async function markOwnPasswordChanged(): Promise<void> {
  const profile = await getCachedProfile()
  if (!profile) return
  const supabase = createClient()
  await supabase
    .from('profiles')
    .update({ password_changed_at: new Date().toISOString() })
    .eq('id', profile.id)
}
