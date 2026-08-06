/**
 * Canonical app paths: `/{module}/{section}/...`
 * e.g. /crm_resto/pipeline, /cs_resto/chats, /ops_resto/management, /ops/users
 */
import { isModule, type Module } from '@/lib/modules'

export function moduleFromPathname(pathname: string | null | undefined): Module | null {
  if (!pathname) return null
  const seg = pathname.split('/').filter(Boolean)[0]
  if (seg && isModule(seg)) return seg
  return null
}

/** @example modulePath('crm_resto', 'leads', id) → /crm_resto/leads/{id} */
export function modulePath(
  mod: Module,
  ...parts: Array<string | null | undefined>
): string {
  const cleaned = parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map(p => p.replace(/^\/+|\/+$/g, ''))
  if (!cleaned.length) return `/${mod}`
  return `/${mod}/${cleaned.join('/')}`
}

/** CRM bare path → section after module (no leading slash). */
export function legacyCrmSection(pathname: string): string | null {
  const p = pathname.split('?')[0]
  const roots = [
    'dashboard',
    'leads',
    'pipeline',
    'reports',
    'activity',
    'settings',
    'calendar',
    'notifications',
    'profile',
    'contracts',
    'quotations',
  ]
  for (const s of roots) {
    if (p === `/${s}` || p.startsWith(`/${s}/`)) return p.slice(1)
  }
  return null
}

/** /support/... → section under cs_* module. */
export function legacySupportSection(pathname: string): string | null {
  const p = pathname.split('?')[0]
  if (p === '/support' || p === '/support/') return 'dashboard'
  if (p.startsWith('/support/')) return p.slice('/support/'.length)
  return null
}

/**
 * Product ops bare paths under /ops/(management|tenants|…).
 * Bare `/ops` is reserved for platform Ops home.
 */
export function legacyProductOpsSection(pathname: string): string | null {
  const p = pathname.split('?')[0]
  if (p === '/ops/management' || p.startsWith('/ops/management/')) {
    return p.slice('/ops/'.length)
  }
  if (p === '/ops/tenants' || p.startsWith('/ops/tenants/')) {
    const rest = p.slice('/ops/tenants'.length)
    return rest ? `management${rest}` : 'management'
  }
  if (
    p === '/ops/logs' ||
    p.startsWith('/ops/logs/') ||
    p === '/ops/reports' ||
    p.startsWith('/ops/reports/') ||
    p === '/ops/subscription' ||
    p.startsWith('/ops/subscription/')
  ) {
    return p.slice('/ops/'.length)
  }
  return null
}

/** /platform/users → users under platform module `ops`. */
export function legacyPlatformSection(pathname: string): string | null {
  const p = pathname.split('?')[0]
  if (p === '/platform' || p === '/platform/') return ''
  if (p === '/platform/users' || p.startsWith('/platform/users/')) {
    return p.slice('/platform/'.length)
  }
  return null
}
