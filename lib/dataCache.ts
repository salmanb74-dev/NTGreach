import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, Product, UserProfile } from '@/lib/roles'

// ── Auth — cached once per request ────────────────────────────
export const getUser = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// ── Profile — cached once per request ─────────────────────────
export const getCachedProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getUser()
  if (!user) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles, products')
    .eq('id', user.id)
    .single()
  if (!data) return null
  return {
    id:        data.id,
    full_name: data.full_name,
    email:     data.email,
    roles:     (data.roles    ?? []) as UserRole[],
    products:  (data.products ?? []) as Product[],
  }
})

// ── App settings — cached once per request ─────────────────────
export const getAppSettings = cache(async (): Promise<Record<string, string>> => {
  const supabase = createClient()
  const { data } = await supabase.from('app_settings').select('key, value')
  const map: Record<string, string> = {}
  ;(data ?? []).forEach(s => { map[s.key] = s.value })
  return map
})

// ── Exchange rates — cached once per request ───────────────────
export const getCurrentRates = cache(async () => {
  const supabase = createClient()
  const { data } = await supabase.from('exchange_rates').select('*')
  return data ?? []
})

// ── Rate history — scoped to last 2 years ─────────────────────
export const getRecentRateHistory = cache(async (inputCurrency: string, viewCurrencies: string[]) => {
  const supabase = createClient()
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  if (viewCurrencies.filter(c => c !== inputCurrency).length === 0) return []
  const { data } = await supabase
    .from('exchange_rate_history')
    .select('base, target, rate, rate_date')
    .gte('rate_date', twoYearsAgo.toISOString().split('T')[0])
    .order('rate_date', { ascending: false })
  return data ?? []
})

// ── Convenience helpers ────────────────────────────────────────
export const getInputCurrency = cache(async (): Promise<string> => {
  const settings = await getAppSettings()
  return settings['input_currency'] ?? 'PKR'
})

export const getViewCurrencies = cache(async (): Promise<string[]> => {
  const settings = await getAppSettings()
  const input = settings['input_currency'] ?? 'PKR'
  return (settings['view_currencies'] ?? input).split(',').map(c => c.trim())
})
