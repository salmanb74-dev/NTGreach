import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function copyPreviousDayRates(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  today: string
) {
  const { data: latest } = await supabase
    .from('exchange_rate_history')
    .select('rate_date')
    .lt('rate_date', today)
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return { copied: 0 as number, fromDate: null as string | null }

  const { data: prevRates } = await supabase
    .from('exchange_rate_history')
    .select('base, target, rate')
    .eq('rate_date', latest.rate_date)

  if (!prevRates?.length) {
    return { copied: 0 as number, fromDate: latest.rate_date as string }
  }

  const todayRates = prevRates.map(r => ({
    base: r.base,
    target: r.target,
    rate: r.rate,
    rate_date: today,
    fetched_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('exchange_rate_history')
    .upsert(todayRates, { onConflict: 'base,target,rate_date' })

  if (error) throw new Error(`copy previous rates: ${error.message}`)

  const currentRates = prevRates.map(r => ({
    base: r.base,
    target: r.target,
    rate: r.rate,
    fetched_at: new Date().toISOString(),
  }))
  await supabase
    .from('exchange_rates')
    .upsert(currentRates, { onConflict: 'base,target' })

  return { copied: todayRates.length, fromDate: latest.rate_date as string }
}

/** USD→currency rates map. Providers return slightly different shapes. */
async function fetchUsdRates(
  apiKey: string | undefined
): Promise<{ rates: Record<string, number>; provider: string }> {
  // Prefer ExchangeRate-API v6 when keyed (broader coverage incl. many FX pairs)
  if (apiKey) {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`exchangerate-api.com HTTP ${res.status}`)
    const data = (await res.json()) as {
      result?: string
      conversion_rates?: Record<string, number>
      'error-type'?: string
    }
    if (data.result !== 'success' || !data.conversion_rates) {
      throw new Error(data['error-type'] ?? 'exchangerate-api.com error')
    }
    return {
      rates: { USD: 1, ...data.conversion_rates },
      provider: 'exchangerate-api.com',
    }
  }

  // Free open endpoint (no key) — same org; good coverage for PKR etc.
  const openRes = await fetch('https://open.er-api.com/v6/latest/USD', {
    cache: 'no-store',
  })
  if (openRes.ok) {
    const data = (await openRes.json()) as {
      result?: string
      rates?: Record<string, number>
    }
    if (data.result === 'success' && data.rates) {
      return {
        rates: { USD: 1, ...data.rates },
        provider: 'open.er-api.com',
      }
    }
  }

  // ECB-backed free fallback (subset of currencies; may miss PKR)
  const frankRes = await fetch('https://api.frankfurter.app/latest?from=USD', {
    cache: 'no-store',
  })
  if (!frankRes.ok) {
    throw new Error(
      `Free rate providers failed (open.er-api ${openRes.status}, frankfurter ${frankRes.status})`
    )
  }
  const frank = (await frankRes.json()) as { rates?: Record<string, number> }
  if (!frank.rates) throw new Error('frankfurter.app returned no rates')
  return {
    rates: { USD: 1, ...frank.rates },
    provider: 'frankfurter.app',
  }
}

export async function GET() {
  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim()
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    // ── Try live API ───────────────────────────────────────────
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['input_currency', 'view_currencies'])

      const settingsMap: Record<string, string> = {}
      settings?.forEach(s => {
        settingsMap[s.key] = s.value
      })

      const inputCurrency = settingsMap['input_currency'] ?? 'PKR'
      const viewCurrencies = (settingsMap['view_currencies'] ?? 'PKR,USD')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
      const allCurrencies = Array.from(
        new Set([inputCurrency, ...viewCurrencies, 'USD', 'PKR'])
      )

      const { rates: usdRates, provider } = await fetchUsdRates(apiKey)

      const upserts: object[] = []
      const historyUpserts: object[] = []
      const fetchedAt = new Date().toISOString()
      const missing: string[] = []

      for (const code of allCurrencies) {
        if (usdRates[code] == null) missing.push(code)
      }

      for (const from of allCurrencies) {
        for (const to of allCurrencies) {
          if (from === to) continue
          const fromRate = usdRates[from]
          const toRate = usdRates[to]
          if (!fromRate || !toRate) continue
          const rate = toRate / fromRate
          upserts.push({ base: from, target: to, rate, fetched_at: fetchedAt })
          historyUpserts.push({
            base: from,
            target: to,
            rate,
            rate_date: today,
            fetched_at: fetchedAt,
          })
        }
      }

      if (upserts.length === 0) {
        throw new Error(
          `Provider ${provider} had none of: ${allCurrencies.join(', ')}`
        )
      }

      await supabase
        .from('exchange_rates')
        .upsert(upserts, { onConflict: 'base,target' })
      await supabase
        .from('exchange_rate_history')
        .upsert(historyUpserts, { onConflict: 'base,target,rate_date' })

      return NextResponse.json({
        ok: true,
        source: 'live',
        provider,
        date: today,
        pairs: upserts.length,
        updatedAt: fetchedAt,
        missing: missing.length ? missing : undefined,
      })
    } catch (apiErr: unknown) {
      const message =
        apiErr instanceof Error ? apiErr.message : 'Live fetch failed'
      console.warn('Live API failed, copying previous day rates:', message)
    }

    // ── Fallback: copy previous day rates ──────────────────────
    const result = await copyPreviousDayRates(supabase, today)

    if (result.copied === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Could not fetch live exchange rates and no previous rates exist to copy. Check server outbound access, or set EXCHANGE_RATE_API_KEY (exchangerate-api.com) for more reliable coverage.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      source: 'previous_day',
      fromDate: result.fromDate,
      date: today,
      pairs: result.copied,
      note: `Live API unavailable — copied rates from ${result.fromDate}`,
    })
  } catch (err: unknown) {
    console.error('Exchange rate error:', err)
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
