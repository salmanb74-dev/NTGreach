import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isModule, type Module } from '@/lib/modules'
import {
  legacyCrmSection,
  legacyPlatformSection,
  legacyProductOpsSection,
  legacySupportSection,
  moduleFromPathname,
} from '@/lib/module-routing'

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>,
  ms = 8_000
) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auth_timeout')), ms)
      ),
    ])
    return result.data.user
  } catch {
    return null
  }
}

function cookieModule(request: NextRequest): Module | null {
  const v = request.cookies.get('ntg-active-module')?.value
  return v && isModule(v) ? v : null
}

/**
 * Redirect legacy un-prefixed paths → /{module}/…
 */
function legacyModuleRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl
  if (pathname.startsWith('/api/') || pathname === '/login' || pathname === '/') {
    return null
  }

  if (moduleFromPathname(pathname)) {
    return null
  }

  const mod = cookieModule(request)
  const url = request.nextUrl.clone()
  url.search = search

  const platformSec = legacyPlatformSection(pathname)
  if (platformSec !== null) {
    url.pathname = platformSec ? `/ops/${platformSec}` : '/ops'
    return NextResponse.redirect(url)
  }

  const supportSec = legacySupportSection(pathname)
  if (supportSec !== null) {
    const cs =
      mod && mod.startsWith('cs_') ? mod : ('cs_resto' as Module)
    url.pathname = `/${cs}/${supportSec}`
    return NextResponse.redirect(url)
  }

  const opsProductSec = legacyProductOpsSection(pathname)
  if (opsProductSec !== null) {
    const product =
      mod && mod.startsWith('ops_') ? mod : ('ops_resto' as Module)
    url.pathname = `/${product}/${opsProductSec}`
    return NextResponse.redirect(url)
  }

  const crmSec = legacyCrmSection(pathname)
  if (crmSec !== null) {
    const crm =
      // Prefer CRM cookie; else resto default for bare CRM routes
      mod && mod.startsWith('crm_') ? mod : ('crm_resto' as Module)
    url.pathname = `/${crm}/${crmSec}`
    return NextResponse.redirect(url)
  }

  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const user = await getUserWithTimeout(supabase)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user) {
    const redir = legacyModuleRedirect(request)
    if (redir) {
      supabaseResponse.cookies.getAll().forEach(c => {
        redir.cookies.set(c.name, c.value)
      })
      return redir
    }

    // Keep active module in sync with URL
    const pathMod = moduleFromPathname(pathname)
    if (pathMod) {
      supabaseResponse.cookies.set('ntg-active-module', pathMod, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
