import { type NextRequest, NextResponse } from 'next/server'
import { construirCsp, generarNonce } from './server/csp'
import { NOMBRES_COOKIE_SESION } from './server/nombres-cookies'

/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ESTE PROXY NO ES CONTROL DE ACCESO.                                 ║
 * ║                                                                      ║
 * ║  Solo mira si EXISTE una cookie de sesión para redirigir a /acceso   ║
 * ║  (comodidad de interfaz). No valida la sesión, no conoce permisos y  ║
 * ║  se ha podido eludir en el pasado (CVE de bypass de middleware de    ║
 * ║  Next.js en 2026). La seguridad real está en CADA página, layout,    ║
 * ║  server action y route handler: `requireActor()` / `accionPanel`.    ║
 * ║  Nunca protejas nada solo aquí.                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Trabajo real del proxy:
 *  1. CSP con nonce por petición (la lee Next y la aplica a sus scripts).
 *  2. Redirecciones de UX para /panel y /acceso.
 *  3. Bloquear rutas que nunca deben servirse (/.git, /.env, volcados).
 *  4. `X-Robots-Tag: noindex` en panel y acceso.
 */

const RUTAS_PROHIBIDAS = /(^|\/)\.(git|env|svn|hg|DS_Store)|\.(sql|bak|zip|tar|gz|7z|log|pem|key)$|\/dump[^/]*$/i

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (RUTAS_PROHIBIDAS.test(pathname)) return new NextResponse(null, { status: 404 })

  const tieneCookieSesion = NOMBRES_COOKIE_SESION.some((n) => request.cookies.has(n))
  const esPanel = pathname === '/panel' || pathname.startsWith('/panel/')

  // UX: sin cookie no tiene sentido pintar el panel; el layout volvería a comprobarlo de verdad.
  if (esPanel && !tieneCookieSesion) {
    const destino = new URL('/acceso', request.url)
    destino.searchParams.set('siguiente', `${pathname}${search}`.slice(0, 300))
    return NextResponse.redirect(destino)
  }

  const nonce = generarNonce()
  const csp = construirCsp({
    nonce,
    esDesarrollo: process.env.NODE_ENV !== 'production',
    esHttps: request.nextUrl.protocol === 'https:' || (process.env.APP_URL ?? '').startsWith('https:'),
  })
  const cabeceraCsp = process.env.CSP_SOLO_REPORTE === 'si' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

  // Next lee la CSP y el nonce de la PETICIÓN para poner el nonce en sus scripts.
  const cabecerasPeticion = new Headers(request.headers)
  cabecerasPeticion.set('x-nonce', nonce)
  cabecerasPeticion.set('Content-Security-Policy', csp)

  const respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } })
  respuesta.headers.set(cabeceraCsp, csp)
  if (esPanel || pathname === '/acceso') respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return respuesta
}

export const config = {
  matcher: [
    {
      // Todo salvo estáticos (que no llevan HTML ni scripts en línea).
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|img/|marca/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
