import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key here — webhook runs outside user session
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Mailjet sends inbound emails as multipart/form-data or JSON
// depending on configuration. We handle both.
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret to prevent spoofing
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') ?? ''
    let recipient = ''
    let sender = ''
    let subject = ''
    let text = ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      // Mailjet parse API sends array of messages
      const msg = Array.isArray(body) ? body[0] : body
      recipient = msg.Recipient ?? msg.recipient ?? ''
      sender    = msg.Sender    ?? msg.sender    ?? msg.From ?? ''
      subject   = msg.Subject   ?? msg.subject   ?? '(no subject)'
      text      = msg.Text      ?? msg.text      ?? msg['stripped-text'] ?? ''
    } else {
      // form-data
      const form = await req.formData()
      recipient = (form.get('recipient') as string) ?? ''
      sender    = (form.get('sender')    as string) ?? ''
      subject   = (form.get('Subject')   as string) ?? (form.get('subject') as string) ?? '(no subject)'
      text      = (form.get('text-part') as string) ?? (form.get('Text')    as string) ?? ''
    }

    if (!recipient) {
      return NextResponse.json({ error: 'No recipient found' }, { status: 400 })
    }

    // Extract lead ID from address: lead-{uuid}@mail.ntgclarity.com
    const match = recipient.match(/lead-([a-f0-9-]{36})@/i)
    if (!match) {
      console.warn(`[inbound] No lead ID in recipient: ${recipient}`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    const leadId = match[1]
    const supabase = getSupabaseAdmin()

    // Verify lead exists
    const { data: lead } = await supabase
      .from('leads')
      .select('id, contact_name')
      .eq('id', leadId)
      .single()

    if (!lead) {
      console.warn(`[inbound] Lead not found: ${leadId}`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Save to emails table
    await supabase.from('emails').insert({
      lead_id:   leadId,
      subject,
      body:      text,
      direction: 'inbound',
      status:    'delivered',
    })

    // Save to activities timeline
    await supabase.from('activities').insert({
      lead_id:   leadId,
      type:      'email_inbound',
      subject:   `Re: ${subject}`,
      body:      text.slice(0, 2000), // trim very long replies
      direction: 'inbound',
      metadata:  { from: sender },
    })

    console.log(`[inbound] Saved reply from ${sender} to lead ${leadId} (${lead.contact_name})`)
    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[inbound] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Mailjet also sends GET for webhook verification
export async function GET() {
  return NextResponse.json({ ok: true })
}
