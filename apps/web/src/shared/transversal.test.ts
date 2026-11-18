import { describe, expect, it } from 'vitest'
import { construirCsp, generarNonce } from '@/server/csp'
import { basicAuthValido, bearerTokenValido } from '@/server/http'
import { redactar } from '@/server/registro'
import { actorDe, crearMundoMemoria } from '@/test/mundo-memoria'
import { Actor } from './domain/actor'
import { enmascararCorreo, enmascararFinal } from './domain/enmascarar'
import { NoAutorizado } from './domain/errores'
import { codificarCursor, decodificarCursor, Paginacion, paginarOrdenado } from './domain/paginacion'
import { crearLimitadorMemoria } from './infrastructure/limitador-memoria'
import { crearRelojFijo } from './infrastructure/reloj'

describe('limitador de tasa en memoria', () => {
  it('bloquea al superar el límite y libera al cambiar de ventana', async () => {
    const reloj = crearRelojFijo(new Date('2026-01-01T00:00:00Z'))
    const limitador = crearLimitadorMemoria(reloj)
    for (let i = 0; i < 3; i++) expect((await limitador.consumir('k', 3, 60)).permitido).toBe(true)
    const bloqueado = await limitador.consumir('k', 3, 60)
    expect(bloqueado).toMatchObject({ permitido: false, reintentarEnSegundos: 60 })
    expect((await limitador.consumir('otra', 3, 60)).permitido).toBe(true)
    reloj.avanzar(61_000)
    expect((await limitador.consumir('k', 3, 60)).permitido).toBe(true)
  })
})

describe('paginación', () => {
  it('el cursor es opaco y reversible', () => {
    const clave = { en: '2026-11-16T00:00:00.000Z', id: 'abc' }
    expect(decodificarCursor(codificarCursor(clave))).toEqual(clave)
    const conOrden = { en: '0'.repeat(60), id: 'abc', o: 'monto:asc' }
    expect(decodificarCursor(codificarCursor(conOrden))).toEqual(conOrden)
  })

  it('un límite fuera de rango se recorta, no falla', () => {
    expect(Paginacion.parse({ limite: 5000 }).limite).toBe(100)
    expect(Paginacion.parse({ limite: -3 }).limite).toBe(1)
    expect(Paginacion.parse({ limite: 'x' }).limite).toBe(20)
    expect(Paginacion.parse({}).limite).toBe(20)
  })

  it('paginarOrdenado recorre en asc y desc con desempate por id e invalida si cambia el orden', () => {
    const asc = [
      { v: '0010', id: 'a' },
      { v: '0010', id: 'b' },
      { v: '0020', id: 'c' },
    ]
    const claveAsc = (x: (typeof asc)[number]) => ({ en: x.v, id: x.id, o: 'v:asc' })
    const p1 = paginarOrdenado(asc, claveAsc, Paginacion.parse({ limite: 2 }), 'asc', 'v:asc')
    expect(p1.elementos.map((x) => x.id)).toEqual(['a', 'b'])
    expect(p1.cursorSiguiente).not.toBeNull()

    const p2 = paginarOrdenado(
      asc,
      claveAsc,
      Paginacion.parse({ limite: 2, cursor: p1.cursorSiguiente ?? undefined }),
      'asc',
      'v:asc',
    )
    expect(p2.elementos.map((x) => x.id)).toEqual(['c'])
    expect(p2.cursorSiguiente).toBeNull()

    // Si cambia el orden esperado, el cursor previo se ignora y empieza desde el principio.
    const desc = [...asc].reverse()
    const claveDesc = (x: (typeof asc)[number]) => ({ en: x.v, id: x.id, o: 'v:desc' })
    const reinicio = paginarOrdenado(
      desc,
      claveDesc,
      Paginacion.parse({ limite: 2, cursor: p1.cursorSiguiente ?? undefined }),
      'desc',
      'v:desc',
    )
    expect(reinicio.elementos.map((x) => x.id)).toEqual(['c', 'b'])
  })
})

describe('enmascarado de datos personales', () => {
  it('muestra solo lo mínimo', () => {
    expect(enmascararCorreo('ana.munoz@correo.test')).toBe('a•••@correo.test')
    expect(enmascararFinal('+573001234821')).toBe('•••• 4821')
  })
})

describe('registro (logs) sin datos sensibles', () => {
  it('redacta claves sensibles y números con forma de tarjeta', () => {
    const salida = JSON.stringify(
      redactar({ correo: 'a@b.test', contrasena: 'x', detalle: 'pago con 4111 1111 1111 1111', nested: { token: 't' } }),
    )
    expect(salida).not.toContain('a@b.test')
    expect(salida).not.toContain('4111')
    expect(salida).not.toMatch(/"token":"t"/)
  })
})

describe('CSP', () => {
  it('usa nonce + strict-dynamic, solo Turnstile y form-action Openpay en producción y bloquea framing', () => {
    const csp = construirCsp({ nonce: 'abc', esDesarrollo: false, esHttps: true })
    expect(csp).toContain(`script-src 'self' 'nonce-abc' 'strict-dynamic' https://challenges.cloudflare.com`)
    expect(csp).toContain(`form-action 'self' https://api.openpay.co https://checkout.openpay.co`)
    expect(csp).toContain(`frame-ancestors 'none'`)
    expect(csp).toContain(`object-src 'none'`)
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('sandbox-api.openpay.co')
    const terceros = csp.match(/https:\/\/[^\s;]+/g) ?? []
    expect(new Set(terceros)).toEqual(
      new Set(['https://challenges.cloudflare.com', 'https://api.openpay.co', 'https://checkout.openpay.co']),
    )
  })

  it('usa sandbox-api.openpay.co en desarrollo y solo admite origenCheckoutOpenpay https en form-action', () => {
    const cspDev = construirCsp({
      nonce: 'abc',
      esDesarrollo: true,
      esHttps: false,
      origenCheckoutOpenpay: 'https://pagos.openpay.co/ruta-ignorada',
    })
    expect(cspDev).toContain(`form-action 'self' https://sandbox-api.openpay.co https://pagos.openpay.co`)
    expect(cspDev).toContain(`frame-src https://challenges.cloudflare.com`)
    expect(cspDev).toContain(`connect-src 'self' ws:`)

    const cspInvalido = construirCsp({
      nonce: 'abc',
      esDesarrollo: false,
      esHttps: true,
      origenCheckoutOpenpay: 'http://inseguro.test',
    })
    expect(cspInvalido).not.toContain('inseguro.test')
  })

  it('genera nonces distintos de 128 bits', () => {
    const a = generarNonce()
    expect(a).not.toBe(generarNonce())
    expect(atob(a)).toHaveLength(16)
  })
})

describe('Basic y Bearer auth', () => {
  const cabecera = (u: string, c: string) => `Basic ${Buffer.from(`${u}:${c}`).toString('base64')}`
  it('acepta solo las credenciales Basic exactas', () => {
    expect(basicAuthValido(cabecera('openpay', 'secreto-largo'), 'openpay', 'secreto-largo')).toBe(true)
    expect(basicAuthValido(cabecera('openpay', 'otro'), 'openpay', 'secreto-largo')).toBe(false)
    expect(basicAuthValido(null, 'openpay', 'secreto-largo')).toBe(false)
    expect(basicAuthValido('Bearer x', 'openpay', 'secreto-largo')).toBe(false)
  })

  it('acepta solo el Bearer token exacto', () => {
    expect(bearerTokenValido('Bearer secreto-cron-largo', 'secreto-cron-largo')).toBe(true)
    expect(bearerTokenValido('Bearer otro', 'secreto-cron-largo')).toBe(false)
    expect(bearerTokenValido('Bearer ', 'secreto-cron-largo')).toBe(false)
    expect(bearerTokenValido('Basic xxx', 'secreto-cron-largo')).toBe(false)
    expect(bearerTokenValido(null, 'secreto-cron-largo')).toBe(false)
  })
})

describe('auditoría', () => {
  it('solo inserción, filtrable y con permiso de lectura', async () => {
    const m = crearMundoMemoria()
    await m.registrarAuditoria({
      accion: 'ajustes.cambiados',
      actorId: 'u1',
      recurso: 'ajustes',
      recursoId: null,
      ip: null,
      detalles: { campo: 'x' },
    })
    expect((await m.listarAuditoria({ actorId: 'u1' }, {}, actorDe('consulta'))).total).toBe(1)
    await expect(m.listarAuditoria({}, {}, new Actor('x', 'x', 'x@x.test', 'x', [], 'aal2'))).rejects.toThrow(NoAutorizado)
    await expect(m.registrarAuditoria({ accion: 'inventada' })).rejects.toThrow()

    const t0 = new Date(m.reloj.ahora().getTime())
    m.reloj.avanzar(60_000)
    await m.registrarAuditoria({
      accion: 'ajustes.cambiados',
      actorId: 'u2',
      recurso: 'ajustes',
      recursoId: null,
      ip: null,
      detalles: { campo: 'y' },
    })
    const t1 = new Date(m.reloj.ahora().getTime())
    m.reloj.avanzar(60_000)
    await m.registrarAuditoria({
      accion: 'ajustes.cambiados',
      actorId: 'u3',
      recurso: 'ajustes',
      recursoId: null,
      ip: null,
      detalles: { campo: 'z' },
    })

    const soloMedio = await m.listarAuditoria({ desde: new Date(t0.getTime() + 1), hasta: t1 }, {}, actorDe('consulta'))
    expect(soloMedio.elementos.map((e) => e.actorId)).toEqual(['u2'])
  })
})
