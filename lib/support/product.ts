import type { Module } from '@/lib/modules'

/** Product brand for Support chats, visits, and roster shifts. */
export type SupportProduct = 'resto' | 'alma'

export function isSupportProduct(value: string): value is SupportProduct {
  return value === 'resto' || value === 'alma'
}

export function parseSupportProduct(value: string): SupportProduct {
  if (isSupportProduct(value)) return value
  throw new Error('Invalid product')
}

/** Map active cs_* module to roster/chat/visit product. */
export function productFromCsModule(mod: Module): SupportProduct | null {
  if (mod === 'cs_resto') return 'resto'
  if (mod === 'cs_alma') return 'alma'
  return null
}

export function csModuleForProduct(product: SupportProduct): Module {
  return product === 'alma' ? 'cs_alma' : 'cs_resto'
}

export function supportProductLabel(product: SupportProduct): string {
  return product === 'alma' ? 'Support Alma' : 'Support Resto'
}
