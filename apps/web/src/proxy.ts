import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { construirCsp, generarNonce, normalizarOrigenHttps } from './server/csp'
import { NOMBRES_COOKIE_SESION, nombresCookies } from './server/nombres-cookies'

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
 *  1. Refrescar tokens de sesión de Supabase Auth cuando `ADAPTADORES === 'real'`.
 *  2. CSP con nonce por petición (la lee Next y la aplica a sus scripts).
 *  3. Redirecciones de UX para /panel y /acceso.
 *  4. Bloquear rutas que nunca deben servirse (/.git, /.env, volcados).
 *  5. `X-Robots-Tag: noindex` en panel y acceso.
 */

const RUTAS_PROHIBIDAS = /(^|\/)\.(git|env|svn|hg|DS_Store)|\.(sql|bak|zip|tar|gz|7z|log|pem|key)$|\/dump[^/]*$/i

type CookiePorEscribir = Readonly<{
  name: string
  value: string
  options?: CookieOptions
}>

function esCookieSesion(nombre: string): boolean {
  return NOMBRES_COOKIE_SESION.some((n) => nombre === n || nombre.startsWith(`${n}.`))
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (RUTAS_PROHIBIDAS.test(pathname)) return new NextResponse(null, { status: 404 })

  const esHttps = request.nextUrl.protocol === 'https:' || (process.env.APP_URL ?? '').startsWith('https:')
  const esPanel = pathname === '/panel' || pathname.startsWith('/panel/')

  const cookiesRefrescadas = new Map<string, CookiePorEscribir>()
  const cabecerasRefresco = new Map<string, string>()

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (process.env.ADAPTADORES === 'real' && supabaseUrl && supabaseAnonKey) {
    const nombreCookieSesion = nombresCookies(esHttps).sesion
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }))
        },
        setAll(cookiesPorEscribir, cabeceras = {}) {
          for (const { name, value, options } of cookiesPorEscribir) {
            const expiraEnPasado = options?.expires ? options.expires.getTime() <= 0 : false
            if (value === '' || options?.maxAge === 0 || expiraEnPasado) {
              request.cookies.delete(name)
            } else {
              request.cookies.set(name, value)
            }
            cookiesRefrescadas.set(name, { name, value, options })
          }
          for (const [clave, valor] of Object.entries(cabeceras)) {
            cabecerasRefresco.set(clave, valor)
          }
        },
      },
      cookieOptions: {
        name: nombreCookieSesion,
        httpOnly: true,
        secure: esHttps,
        sameSite: 'strict',
        path: '/',
      },
    })

    try {
      await supabase.auth.getUser()
    } catch {
      // UX + CSP únicamente: la validación real de sesión ocurre en requireActor() / accionPanel.
    }
  }

  function propagarCookiesRefrescadas(respuesta: NextResponse): NextResponse {
    for (const { name, value, options } of cookiesRefrescadas.values()) {
      respuesta.cookies.set(name, value, {
        ...options,
        httpOnly: true,
        secure: esHttps,
        sameSite: 'strict',
        path: options?.path ?? '/',
      })
    }
    for (const [clave, valor] of cabecerasRefresco) {
      respuesta.headers.set(clave, valor)
    }
    return respuesta
  }

  const tieneCookieSesion = request.cookies.getAll().some((c) => esCookieSesion(c.name))

  // UX: sin cookie no tiene sentido pintar el panel; el layout volvería a comprobarlo de verdad.
  if (esPanel && !tieneCookieSesion) {
    const destino = new URL('/acceso', request.url)
    destino.searchParams.set('siguiente', `${pathname}${search}`.slice(0, 300))
    return propagarCookiesRefrescadas(NextResponse.redirect(destino))
  }

  const nonce = generarNonce()
  const pasarela = process.env.PASARELA === 'mercadopago' ? 'mercadopago' : 'openpay'
  const csp = construirCsp({
    nonce,
    esDesarrollo: process.env.NODE_ENV !== 'production',
    esHttps,
    pasarela,
    openpaySandbox:
      process.env.OPENPAY_SANDBOX_EN_PRODUCCION === 'si' && process.env.OPENPAY_API_URL === 'https://sandbox-api.openpay.co',
    mercadopagoSandbox: process.env.MERCADOPAGO_MODO === 'sandbox',
    origenCheckoutOpenpay: normalizarOrigenHttps(process.env.OPENPAY_CHECKOUT_ORIGIN) ?? undefined,
  })
  const cabeceraCsp = process.env.CSP_SOLO_REPORTE === 'si' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

  // Next lee la CSP y el nonce de la PETICIÓN para poner el nonce en sus scripts.
  const cabecerasPeticion = new Headers(request.headers)
  cabecerasPeticion.set('x-nonce', nonce)
  cabecerasPeticion.set('Content-Security-Policy', csp)

  const respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } })
  respuesta.headers.set(cabeceraCsp, csp)
  if (esPanel || pathname === '/acceso') respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return propagarCookiesRefrescadas(respuesta)
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
