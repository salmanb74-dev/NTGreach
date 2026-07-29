const { schedule } = require('@netlify/functions')

exports.handler = schedule('0 6 * * *', async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL not set')
    return { statusCode: 500, body: 'NEXT_PUBLIC_APP_URL not set' }
  }

  try {
    const res  = await fetch(`${appUrl}/api/exchange-rates`)
    const data = await res.json()

    if (!res.ok) {
      console.error('Exchange rate fetch failed:', data)
      return { statusCode: 500, body: JSON.stringify(data) }
    }

    const msg = data.source === 'previous_day'
      ? `Copied rates from ${data.fromDate}`
      : `Updated ${data.pairs} pairs for ${data.date}`

    console.log(msg)
    return { statusCode: 200, body: msg }
  } catch (err) {
    console.error('Scheduled exchange rate error:', err)
    return { statusCode: 500, body: err.message }
  }
})
