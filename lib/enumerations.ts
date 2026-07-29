import { createClient } from '@/lib/supabase/server'

export interface EnumOption {
  value: string
  label: string
}

export async function getEnumerations(category: string): Promise<EnumOption[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('enumerations')
    .select('value, label')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function getFormEnumerations() {
  const [companyTypes, leadSources, cities] = await Promise.all([
    getEnumerations('company_type'),
    getEnumerations('lead_source'),
    getEnumerations('city'),
  ])
  return { companyTypes, leadSources, cities }
}
