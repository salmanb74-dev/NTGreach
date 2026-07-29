import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function copyPreviousDayRates(supabase: any, today: string) {
  // Find the most recent date we have rates for
  const { data: latest } = await supabase
    .from('exchange_rate_history')
    .select('rate_date')
    .lt('rate_date', today)
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return { copied: 0 }

  // Get all rates for that date
  const { data: prevRates } = await supabase
    .from('exchange_rate_history')
    .select('base, target, rate')
    .eq('rate_date', latest.rate_date)

  if (!prevRates?.length) return { copied: 0 }

  // Copy them to today
  const todayRates = prevRates.map((r: any) => ({
    base:       r.base,
    target:     r.target,
    rate:       r.rate,
    rate_date:  today,
    fetched_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('exchange_rate_history')
    .upsert(todayRates, { onConflict: 'base,target,rate_date' })

  if (error) throw new Error(`copy previous rates: ${error.message}`)

  // Also update current rates table
  const currentRates = prevRates.map((r: any) => ({
    base:       r.base,
    target:     r.target,
    rate:       r.rate,
    fetched_at: new Date().toISOString(),
  }))
  await supabase
    .from('exchange_rates')
    .upsert(currentRates, { onConflict: 'base,target' })

  return { copied: todayRates.length, fromDate: latest.rate_date }
}

export async function GET() {
  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    // ── Try live API first ─────────────────────────────────────
    if (apiKey) {
      try {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['input_currency', 'view_currencies'])

        const settingsMap: Record<string, string> = {}
        settings?.forEach((s: any) => { settingsMap[s.key] = s.value })

        const inputCurrency  = settingsMap['input_currency']  ?? 'PKR'
        const viewCurrencies = (settingsMap['view_currencies'] ?? 'PKR,USD').split(',').map((c: string) => c.trim())
        const allCurrencies  = Array.from(new Set([inputCurrency, ...viewCurrencies, 'USD', 'PKR']))

        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`API error: ${res.status}`)

        const data = await res.json()
        if (data.result !== 'success') throw new Error(data['error-type'] ?? 'API error')

        const usdRates: Record<string, number> = { USD: 1, ...data.conversion_rates }

        const upserts: object[]        = []
        const historyUpserts: object[] = []
        const fetchedAt = new Date().toISOString()

        for (const from of allCurrencies) {
          for (const to of allCurrencies) {
            if (from === to) continue
            const fromRate = usdRates[from]
            const toRate   = usdRates[to]
            if (!fromRate || !toRate) continue
            const rate = toRate / fromRate
            upserts.push({ base: from, target: to, rate, fetched_at: fetchedAt })
            historyUpserts.push({ base: from, target: to, rate, rate_date: today, fetched_at: fetchedAt })
          }
        }

        if (upserts.length > 0) {
          await supabase.from('exchange_rates').upsert(upserts, { onConflict: 'base,target' })
        }
        if (historyUpserts.length > 0) {
          await supabase.from('exchange_rate_history').upsert(historyUpserts, { onConflict: 'base,target,rate_date' })
        }

        return NextResponse.json({
          ok: true, source: 'live', date: today,
          pairs: upserts.length, updatedAt: fetchedAt,
        })
      } catch (apiErr: any) {
        // API failed — fall through to copy previous day
        console.warn('Live API failed, copying previous day rates:', apiErr.message)
      }
    }

    // ── Fallback: copy previous day rates ──────────────────────
    const result = await copyPreviousDayRates(supabase, today)

    if (result.copied === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No live API key set and no previous rates found to copy.',
      }, { status: 400 })
    }

    return NextResponse.json({
      ok: true, source: 'previous_day',
      fromDate: result.fromDate, date: today,
      pairs: result.copied,
      note: `Live API unavailable — copied rates from ${result.fromDate}`,
    })

  } catch (err: any) {
    console.error('Exchange rate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
