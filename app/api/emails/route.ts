import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leadId, to, subject, body } = await req.json()

    if (!leadId || !to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const apiKey    = process.env.MAILJET_API_KEY
    const secretKey = process.env.MAILJET_SECRET_KEY
    const fromEmail = process.env.MAILJET_FROM_EMAIL
    const fromName  = process.env.MAILJET_FROM_NAME ?? 'NTG Reach'
    const inboundDomain = process.env.INBOUND_DOMAIN ?? 'mail.ntgclarity.com'

    if (!apiKey || !secretKey || !fromEmail) {
      return NextResponse.json(
        { error: 'Mailjet not configured. Add MAILJET_API_KEY, MAILJET_SECRET_KEY and MAILJET_FROM_EMAIL to your .env.local' },
        { status: 503 }
      )
    }

    // Unique reply-to address per lead so inbound replies are routed back
    const replyTo = `lead-${leadId}@${inboundDomain}`

    // Send via Mailjet
    const mjRes = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
      },
      body: JSON.stringify({
        Messages: [{
          From:    { Email: fromEmail, Name: fromName },
          To:      [{ Email: to }],
          ReplyTo: { Email: replyTo },
          Subject: subject,
          TextPart: body,
          HTMLPart: body.replace(/\n/g, '<br>'),
        }],
      }),
    })

    const mjData = await mjRes.json()

    if (!mjRes.ok || mjData.Messages?.[0]?.Status !== 'success') {
      throw new Error(mjData.Messages?.[0]?.Errors?.[0]?.ErrorMessage ?? 'Mailjet send failed')
    }

    const mjMessageId = mjData.Messages[0].To[0].MessageID?.toString()

    // Save to emails table
    const { error: emailErr } = await supabase.from('emails').insert({
      lead_id:            leadId,
      mailjet_message_id: mjMessageId,
      subject,
      body,
      direction: 'outbound',
      status:    'sent',
    })
    if (emailErr) throw new Error(emailErr.message)

    // Log to activities timeline
    await supabase.from('activities').insert({
      lead_id:    leadId,
      type:       'email_outbound',
      subject,
      body,
      direction:  'outbound',
      created_by: user.id,
    })

    return NextResponse.json({ ok: true, messageId: mjMessageId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unexpected error' }, { status: 500 })
  }
}
