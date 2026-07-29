// Netlify scheduled function — runs daily at 6 AM UTC
// Fetches latest exchange rates and saves to Supabase

import type { Config } from '@netlify/functions'

export default async function handler() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL
  if (!appUrl) {
    console.error('No app URL found in environment')
    return
  }

  try {
    const res = await fetch(`${appUrl}/api/exchange-rates`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    console.log(`Exchange rates updated: ${data.pairs} pairs for ${data.date}`)
  } catch (err) {
    console.error('Failed to update exchange rates:', err)
  }
}

export const config: Config = {
  schedule: '0 6 * * *', // 6 AM UTC daily
}
