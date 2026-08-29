const STORAGE_KEY = 'crm-dashboard-currency'

export function loadDashboardCurrency(
  viewCurrencies: string[],
  fallback: string
): string | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)?.trim()
    if (saved && viewCurrencies.includes(saved)) return saved
  } catch {
    // ignore
  }
  return null
}

export function saveDashboardCurrency(currency: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, currency)
  } catch {
    // ignore
  }
}

export { STORAGE_KEY as DASHBOARD_CURRENCY_STORAGE_KEY }
