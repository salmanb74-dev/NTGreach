import { createHmac, timingSafeEqual } from 'crypto'

export const SUPPORT_REALTIME_TOKEN_TTL_SECONDS = 10 * 60
export const SUPPORT_REALTIME_REFRESH_AFTER_SECONDS = 5 * 60

type JsonObject = Record<string, unknown>

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(input: string, secret: string) {
  return base64Url(createHmac('sha256', secret).update(input).digest())
}

/**
 * Mint a Supabase-compatible HS256 token for the dedicated support_realtime
 * Postgres role. The matching RLS policy further limits it to one conversation.
 */
export function createSupportRealtimeToken(opts: {
  tenantId: string
  conversationId: string
  subject: string
  now?: Date
}) {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim()
  if (!secret) {
    return null
  }

  const now = opts.now ?? new Date()
  const issuedAt = Math.floor(now.getTime() / 1000)
  const expiresAt = issuedAt + SUPPORT_REALTIME_TOKEN_TTL_SECONDS

  const header: JsonObject = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const payload: JsonObject = {
    aud: 'authenticated',
    exp: expiresAt,
    iat: issuedAt,
    iss: 'supabase',
    role: 'support_realtime',
    sub: opts.subject,
    support_realtime: true,
    support_tenant_id: opts.tenantId,
    support_conversation_id: opts.conversationId,
  }

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload)
  )}`

  return {
    accessToken: `${unsigned}.${sign(unsigned, secret)}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}

/** Test helper: verify an HS256 signature without exposing the signing secret. */
export function verifySupportRealtimeToken(token: string, secret: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret))
  const actual = Buffer.from(parts[2])
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
