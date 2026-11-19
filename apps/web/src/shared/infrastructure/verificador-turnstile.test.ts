import { afterEach, describe, expect, it, vi } from 'vitest'
import { construirCsp } from '@/server/csp'
import { ACCION_TURNSTILE_DONAR, esClaveDePruebaTurnstile } from '@/shared/domain/antibots'
import { crearLimitadorMemoria } from './limitador-memoria'
import { crearRelojFijo } from './reloj'
import { crearVerificadorTurnstile } from './verificador-turnstile'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function responder(cuerpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }))
}

function verificador(extra: Partial<Parameters<typeof crearVerificadorTurnstile>[0]> = {}) {
  return crearVerificadorTurnstile({
    secreto: 'secreto-turnstile',
    hostnameEsperado: 'proinserco.org',
    accionEsperada: ACCION_TURNSTILE_DONAR,
    limitador: crearLimitadorMemoria(crearRelojFijo(new Date('2026-11-18T15:00:00Z'))),
    ...extra,
  })
}

describe('verificación «soy una persona» con Cloudflare Turnstile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifica en servidor contra siteverify con el secreto, el token y la IP', async () => {
    const fetchMock = responder({ success: true, hostname: 'proinserco.org', action: 'donar' })
    vi.stubGlobal('fetch', fetchMock)

    expect(await verificador().verificar('token-ok', '203.0.113.9')).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(SITEVERIFY)
    expect(init.method).toBe('POST')
    const cuerpo = new URLSearchParams(init.body as URLSearchParams)
    expect(Object.fromEntries(cuerpo)).toEqual({ secret: 'secreto-turnstile', response: 'token-ok', remoteip: '203.0.113.9' })
  })

  it('rechaza success=false, otro hostname u otra acción', async () => {
    vi.stubGlobal('fetch', responder({ success: false, 'error-codes': ['invalid-input-response'] }))
    expect(await verificador().verificar('t1', '203.0.113.9')).toBe(false)
    vi.stubGlobal('fetch', responder({ success: true, hostname: 'otro-sitio.test', action: 'donar' }))
    expect(await verificador().verificar('t2', '203.0.113.9')).toBe(false)
    vi.stubGlobal('fetch', responder({ success: true, hostname: 'proinserco.org', action: 'login' }))
    expect(await verificador().verificar('t3', '203.0.113.9')).toBe(false)
  })

  it('un token no se puede usar dos veces (ni llega dos veces a siteverify)', async () => {
    const fetchMock = responder({ success: true, hostname: 'proinserco.org', action: 'donar' })
    vi.stubGlobal('fetch', fetchMock)
    const v = verificador()
    expect(await v.verificar('token-unico', '203.0.113.9')).toBe(true)
    expect(await v.verificar('token-unico', '198.51.100.1')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falla cerrado si Cloudflare no responde, responde 5xx o algo inesperado', async () => {
    const alFallar = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')))
    expect(await verificador({ alFallar }).verificar('a', 'desconocida')).toBe(false)
    vi.stubGlobal('fetch', responder({}, 503))
    expect(await verificador({ alFallar }).verificar('b', 'desconocida')).toBe(false)
    vi.stubGlobal('fetch', responder({ raro: true }))
    expect(await verificador({ alFallar }).verificar('c', 'desconocida')).toBe(false)
    expect(await verificador({ alFallar }).verificar('', 'desconocida')).toBe(false)
    expect(alFallar).toHaveBeenCalledWith('TimeoutError')
    expect(alFallar).toHaveBeenCalledWith('siteverify HTTP 503')
  })

  it('reconoce las claves de prueba de Cloudflare (1x0000, 2x0000, 3x0000)', () => {
    expect(esClaveDePruebaTurnstile('1x00000000000000000000AA')).toBe(true)
    expect(esClaveDePruebaTurnstile('2x0000000000000000000000000000000AA')).toBe(true)
    expect(esClaveDePruebaTurnstile('3x00000000000000000000FF')).toBe(true)
    expect(esClaveDePruebaTurnstile('0x4AAAAAAABcdEfGh')).toBe(false)
    expect(esClaveDePruebaTurnstile(undefined)).toBe(false)
  })

  it('la CSP abre challenges.cloudflare.com solo en script-src y frame-src', () => {
    const csp = construirCsp({ nonce: 'abc', esDesarrollo: false, esHttps: true })
    const directiva = (nombre: string) => csp.split('; ').find((d) => d.startsWith(`${nombre} `)) ?? ''
    expect(directiva('script-src')).toContain("'nonce-abc'")
    expect(directiva('script-src')).toContain('https://challenges.cloudflare.com')
    expect(directiva('frame-src')).toBe('frame-src https://challenges.cloudflare.com')
    expect(directiva('connect-src')).toBe("connect-src 'self'")
    expect(csp.match(/challenges\.cloudflare\.com/g)).toHaveLength(2)
  })
})
