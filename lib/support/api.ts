import { assertNoError } from '@/lib/assert'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export function supportApiUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function supportApiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Validate `x-api-key` against `SUPPORT_API_KEY`. Returns an error response or null. */
export function assertSupportApiKey(request: Request): NextResponse | null {
  const expected = process.env.SUPPORT_API_KEY
  if (!expected) {
    console.error('[support api] SUPPORT_API_KEY is not configured')
    return NextResponse.json({ error: 'Support API is not configured' }, { status: 500 })
  }

  const key = request.headers.get('x-api-key')
  if (!key || key !== expected) {
    return supportApiUnauthorized()
  }
  return null
}

export function getSupportAdmin(): SupabaseClient {
  return getServiceRoleClient()
}

/** Dedicated auth.users id used as created_by / customer sender_id for API traffic. */
export function getSupportApiActorUserId(): string {
  const id = process.env.SUPPORT_API_ACTOR_USER_ID?.trim()
  if (!id) {
    throw new Error('SUPPORT_API_ACTOR_USER_ID is not configured')
  }
  return id
}

export function requireTenantId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function clampLimit(raw: string | null, fallback: number, max: number) {
  const n = raw ? Number.parseInt(raw, 10) : fallback
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}

export type ApiConversation = {
  id: string
  tenant_id: string
  tenant_name: string
  title: string | null
  status: 'open' | 'closed'
  created_by: string
  assigned_to: string | null
  created_at: string
  closed_at: string | null
  last_message_at: string
  product: string
  support_category: 'platform' | 'operational'
  logged_minutes: number
  branch_id: string | null
  branch_name: string | null
}

export type ApiMessage = {
  id: string
  conversation_id: string
  sender_id: string
  sender_type: 'agent' | 'customer'
  sender_display_name: string | null
  message_type: 'text' | 'image' | 'voice' | 'video' | 'file'
  content: string | null
  file_url: string | null
  created_at: string
  read_at: string | null
  expires_at: string | null
}

export function serializeConversation(row: Record<string, unknown>): ApiConversation {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    tenant_name: String(row.tenant_name),
    title: (row.title as string | null) ?? null,
    status: row.status === 'closed' ? 'closed' : 'open',
    created_by: String(row.created_by),
    assigned_to: (row.assigned_to as string | null) ?? null,
    created_at: String(row.created_at),
    closed_at: (row.closed_at as string | null) ?? null,
    last_message_at: String(row.last_message_at ?? row.created_at),
    product: String(row.product ?? 'resto'),
    support_category: row.support_category === 'operational' ? 'operational' : 'platform',
    logged_minutes: Number(row.logged_minutes ?? 0) || 0,
    branch_id:
      typeof row.branch_id === 'string' && row.branch_id.trim()
        ? row.branch_id.trim()
        : null,
    branch_name:
      typeof row.branch_name === 'string' && row.branch_name.trim()
        ? row.branch_name.trim()
        : null,
  }
}

export function serializeMessage(row: Record<string, unknown>): ApiMessage {
  const messageType = row.message_type
  const type =
    messageType === 'image' ||
    messageType === 'voice' ||
    messageType === 'video' ||
    messageType === 'file'
      ? messageType
      : 'text'

  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_id: String(row.sender_id),
    sender_type: row.sender_type === 'agent' ? 'agent' : 'customer',
    sender_display_name: (row.sender_display_name as string | null) ?? null,
    message_type: type,
    content: (row.content as string | null) ?? null,
    file_url: (row.file_url as string | null) ?? null,
    created_at: String(row.created_at),
    read_at: (row.read_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
  }
}

export async function getConversationForTenant(
  admin: SupabaseClient,
  conversationId: string,
  tenantId: string
) {
  const { data, error } = await admin
    .from('support_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()

  assertNoError(error)
  if (!data) return { conversation: null as null, forbidden: false }
  if (String(data.tenant_id) !== tenantId) {
    return { conversation: null as null, forbidden: true }
  }
  return { conversation: data as Record<string, unknown>, forbidden: false }
}
