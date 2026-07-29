import type { Config } from '@netlify/functions'

// Runs every day at 6:00 AM UTC (11 AM PKT)
export default async function handler() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL not set')
    return
  }

  try {
    const res = await fetch(`${appUrl}/api/exchange-rates`)
    const data = await res.json()

    if (!res.ok) {
      console.error('Exchange rate fetch failed:', data)
      return
    }

    console.log(`Exchange rates updated: ${data.pairs} pairs for ${data.date}`)
  } catch (err) {
    console.error('Scheduled exchange rate fetch error:', err)
  }
}

export const config: Config = {
  schedule: '0 6 * * *', // every day at 06:00 UTC
}
