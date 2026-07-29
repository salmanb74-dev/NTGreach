import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mailjet event status mapping
const STATUS_MAP: Record<string, string> = {
  sent:      'sent',
  delivered: 'delivered',
  open:      'opened',
  click:     'clicked',
  bounce:    'failed',
  blocked:   'failed',
  spam:      'failed',
  unsub:     'failed',
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mailjet sends an array of events
    const events = await req.json()
    const supabase = getSupabaseAdmin()

    for (const event of Array.isArray(events) ? events : [events]) {
      const mjMessageId = event.MessageID?.toString()
      const eventType   = event.event as string

      if (!mjMessageId || !eventType) continue

      const newStatus = STATUS_MAP[eventType]
      if (!newStatus) continue

      // Update email status by Mailjet message ID
      const { error } = await supabase
        .from('emails')
        .update({ status: newStatus })
        .eq('mailjet_message_id', mjMessageId)

      if (error) {
        console.warn(`[status] Failed to update ${mjMessageId}:`, error.message)
      } else {
        console.log(`[status] ${mjMessageId} → ${newStatus}`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[status] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
