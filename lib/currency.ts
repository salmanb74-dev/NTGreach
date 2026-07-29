export interface ExchangeRate {
  base:       string
  target:     string
  rate:       number
  fetched_at: string
}

export interface ExchangeRateHistory {
  base:      string
  target:    string
  rate:      number
  rate_date: string
}

/**
 * Convert using current rates.
 */
export function convertAmount(
  amount: number,
  from:   string,
  to:     string,
  rates:  ExchangeRate[]
): number {
  if (from === to || amount === 0) return amount
  const rate = rates.find(r => r.base === from && r.target === to)
  return rate ? amount * rate.rate : amount
}

/**
 * Convert using the historical rate closest to a given date.
 * Falls back to current rates if no historical rate found.
 */
export function convertAmountHistorical(
  amount:       number,
  from:         string,
  to:           string,
  onDate:       string,
  history:      ExchangeRateHistory[],
  currentRates: ExchangeRate[]
): number {
  if (from === to || amount === 0) return amount

  const candidates = history
    .filter(h => h.base === from && h.target === to && h.rate_date <= onDate)
    .sort((a, b) => b.rate_date.localeCompare(a.rate_date))

  if (candidates.length > 0) {
    return amount * candidates[0].rate
  }

  // Fall back to current rate
  return convertAmount(amount, from, to, currentRates)
}

/**
 * Check if historical rate exists for a currency pair on a given date.
 */
export function hasHistoricalRate(
  from:    string,
  to:      string,
  onDate:  string,
  history: ExchangeRateHistory[]
): boolean {
  if (from === to) return true
  return history.some(h => h.base === from && h.target === to && h.rate_date <= onDate)
}

/**
 * Format a number as currency with symbol.
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    PKR: '₨', USD: '$', CAD: 'CA$',
    AED: 'AED', SAR: 'SAR', EUR: '€', GBP: '£',
  }
  const symbol = symbols[currency] ?? currency
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `${symbol}${(amount / 1_000).toFixed(0)}K`
  return `${symbol}${amount.toFixed(0)}`
}
