import { NextRequest, NextResponse } from 'next/server'
import {
  getSubscriptionOfferNotes,
  upsertSubscriptionOfferNotes,
} from '@/lib/ops/subscription-notes'
import { requireOpsNotesProxy } from '@/lib/resto-admin/ops-route'

/**
 * GET /api/ops/tenants/:id/subscription-notes?env=
 * Reach-only internal notes (not sent to Nest).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsNotesProxy(request, params.id)
  if ('error' in ctx) return ctx.error

  try {
    const offerNotes = await getSubscriptionOfferNotes(ctx.tenantId, ctx.env)
    return NextResponse.json({ env: ctx.env, offerNotes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/ops/tenants/:id/subscription-notes?env=
 * Body: { offerNotes: string | null }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireOpsNotesProxy(request, params.id)
  if ('error' in ctx) return ctx.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  const offerNotes =
    record.offerNotes == null
      ? null
      : typeof record.offerNotes === 'string'
        ? record.offerNotes
        : null

  if (record.offerNotes != null && typeof record.offerNotes !== 'string') {
    return NextResponse.json(
      { error: 'offerNotes must be a string or null' },
      { status: 400 }
    )
  }

  try {
    const saved = await upsertSubscriptionOfferNotes(
      ctx.tenantId,
      ctx.env,
      offerNotes
    )
    return NextResponse.json({ env: ctx.env, offerNotes: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
