import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerClientMock, getUserMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

import { proxy } from './proxy'

describe('proxy', () => {
  const envOriginal = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...envOriginal }
    delete process.env.ADAPTADORES
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.APP_URL
    delete process.env.OPENPAY_CHECKOUT_ORIGIN
    delete process.env.OPENPAY_SANDBOX_EN_PRODUCCION
    delete process.env.OPENPAY_API_URL
  })

  afterEach(() => {
    process.env = { ...envOriginal }
  })

  it('bloquea rutas prohibidas con 404', async () => {
    for (const ruta of ['/.git/config', '/.env', '/backup.sql']) {
      const res = await proxy(new NextRequest(`https://proinserco.org${ruta}`))
      expect(res.status).toBe(404)
    }
  })

  it('redirige /panel a /acceso si no existe cookie de sesión ni chunks', async () => {
    const res = await proxy(new NextRequest('https://proinserco.org/panel/donaciones?estado=aprobada'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://proinserco.org/acceso?siguiente=%2Fpanel%2Fdonaciones%3Festado%3Daprobada')
  })

  it('permite /panel cuando existe cookie exacta o chunked (.0, .1) y aplica CSP + noindex', async () => {
    for (const nombreCookie of ['proinserco_sesion', '__Host-proinserco_sesion', '__Host-proinserco_sesion.0']) {
      const req = new NextRequest('https://proinserco.org/panel', {
        headers: { cookie: `${nombreCookie}=valor` },
      })
      const res = await proxy(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
      expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    }
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it('refresca la sesión con @supabase/ssr en modo real y propaga cookies a request y respuesta', async () => {
    process.env.ADAPTADORES = 'real'
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'

    createServerClientMock.mockImplementation((_url, _key, options) => {
      getUserMock.mockImplementation(async () => {
        await options.cookies.setAll(
          [
            { name: '__Host-proinserco_sesion.0', value: 'nuevo-0', options: { path: '/', maxAge: 3600 } },
            { name: '__Host-proinserco_sesion.1', value: 'nuevo-1', options: { path: '/', maxAge: 3600 } },
          ],
          { 'Cache-Control': 'private, no-store' },
        )
        return { data: { user: { id: 'u1' } }, error: null }
      })
      return { auth: { getUser: getUserMock } }
    })

    const req = new NextRequest('https://proinserco.org/panel/donaciones', {
      headers: { cookie: '__Host-proinserco_sesion.0=viejo-0; __Host-proinserco_sesion.1=viejo-1' },
    })

    const res = await proxy(req)

    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://proj.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookieOptions: {
          name: '__Host-proinserco_sesion',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        },
      }),
    )
    expect(getUserMock).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-request-cookie')).toContain('__Host-proinserco_sesion.0=nuevo-0')
    expect(res.headers.get('x-middleware-request-cookie')).toContain('__Host-proinserco_sesion.1=nuevo-1')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')

    const setCookies = res.headers.getSetCookie()
    expect(
      setCookies.some((c) => c.includes('__Host-proinserco_sesion.0=nuevo-0') && c.includes('HttpOnly') && c.includes('Secure')),
    ).toBe(true)
    expect(setCookies.some((c) => c.includes('__Host-proinserco_sesion.1=nuevo-1') && /SameSite=strict/i.test(c))).toBe(true)
  })

  it('propaga borrado de cookies refrescadas sobre el redirect a /acceso si getUser las elimina', async () => {
    process.env.ADAPTADORES = 'real'
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'

    createServerClientMock.mockImplementation((_url, _key, options) => {
      getUserMock.mockImplementation(async () => {
        await options.cookies.setAll([{ name: 'proinserco_sesion.0', value: '', options: { path: '/', maxAge: 0 } }], {
          'Cache-Control': 'private, no-store',
        })
        return { data: { user: null }, error: null }
      })
      return { auth: { getUser: getUserMock } }
    })

    const req = new NextRequest('http://localhost:3000/panel', {
      headers: { cookie: 'proinserco_sesion.0=expirada' },
    })

    const res = await proxy(req)

    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://proj.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookieOptions: {
          name: 'proinserco_sesion',
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
        },
      }),
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/acceso?siguiente=%2Fpanel')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(res.headers.getSetCookie().some((c) => c.includes('proinserco_sesion.0=;') && c.includes('Max-Age=0'))).toBe(true)
  })

  it('no falla si getUser lanza error en modo real y aplica noindex en /acceso', async () => {
    process.env.ADAPTADORES = 'real'
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'

    createServerClientMock.mockImplementation(() => ({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('Supabase auth timeout')),
      },
    }))

    const resAcceso = await proxy(new NextRequest('https://proinserco.org/acceso'))
    expect(resAcceso.status).toBe(200)
    expect(resAcceso.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(resAcceso.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")

    const resPanelSinCookie = await proxy(new NextRequest('https://proinserco.org/panel'))
    expect(resPanelSinCookie.status).toBe(307)
    expect(resPanelSinCookie.headers.get('location')).toBe('https://proinserco.org/acceso?siguiente=%2Fpanel')
  })

  it('propaga OPENPAY_CHECKOUT_ORIGIN válido https a form-action de la CSP e ignora orígenes inválidos', async () => {
    process.env.OPENPAY_CHECKOUT_ORIGIN = 'https://pagos.openpay.co/ruta'
    const resValido = await proxy(new NextRequest('https://proinserco.org/donar'))
    expect(resValido.headers.get('Content-Security-Policy')).toContain('https://pagos.openpay.co')

    process.env.OPENPAY_CHECKOUT_ORIGIN = 'http://inseguro.test'
    const resInvalido = await proxy(new NextRequest('https://proinserco.org/donar'))
    expect(resInvalido.headers.get('Content-Security-Policy')).not.toContain('inseguro.test')
  })

  it('en producción aplica form-action de Openpay producción sin sandbox ni unsafe-eval', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENPAY_CHECKOUT_ORIGIN = 'https://pagos.openpay.co/redirect'

    try {
      const res = await proxy(new NextRequest('https://proinserco.org/donar'))
      expect(res.status).toBe(200)
      const csp = res.headers.get('Content-Security-Policy') ?? ''
      expect(csp).toContain("form-action 'self' https://api.openpay.co https://checkout.openpay.co https://pagos.openpay.co")
      expect(csp).not.toContain('sandbox-api.openpay.co')
      expect(csp).not.toContain('unsafe-eval')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('en producción habilita sandbox-api.openpay.co en form-action solo cuando OPENPAY_SANDBOX_EN_PRODUCCION=si y OPENPAY_API_URL es sandbox', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.OPENPAY_SANDBOX_EN_PRODUCCION = 'si'
    process.env.OPENPAY_API_URL = 'https://sandbox-api.openpay.co'

    try {
      const resSandbox = await proxy(new NextRequest('https://proinserco.org/donar'))
      const cspSandbox = resSandbox.headers.get('Content-Security-Policy') ?? ''
      expect(cspSandbox).toContain(
        "form-action 'self' https://api.openpay.co https://checkout.openpay.co https://sandbox-api.openpay.co",
      )
      expect(cspSandbox).not.toContain('unsafe-eval')

      process.env.OPENPAY_API_URL = 'https://api.openpay.co'
      const resProd = await proxy(new NextRequest('https://proinserco.org/donar'))
      const cspProd = resProd.headers.get('Content-Security-Policy') ?? ''
      expect(cspProd).not.toContain('sandbox-api.openpay.co')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
