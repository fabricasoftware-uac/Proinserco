import { describe, expect, it } from 'vitest'
import { construirCsp, generarNonce } from '@/server/csp'
import { basicAuthValido } from '@/server/http'
import { redactar } from '@/server/registro'
import { actorDe, crearMundoMemoria } from '@/test/mundo-memoria'
import { Actor } from './domain/actor'
import { enmascararCorreo, enmascararFinal } from './domain/enmascarar'
import { NoAutorizado } from './domain/errores'
import { codificarCursor, decodificarCursor, Paginacion } from './domain/paginacion'
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
  })

  it('un límite fuera de rango se recorta, no falla', () => {
    expect(Paginacion.parse({ limite: 5000 }).limite).toBe(100)
    expect(Paginacion.parse({ limite: -3 }).limite).toBe(1)
    expect(Paginacion.parse({ limite: 'x' }).limite).toBe(20)
    expect(Paginacion.parse({}).limite).toBe(20)
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
  it('usa nonce + strict-dynamic, solo Turnstile como tercero y bloquea framing', () => {
    const csp = construirCsp({ nonce: 'abc', esDesarrollo: false, esHttps: true })
    expect(csp).toContain(`script-src 'self' 'nonce-abc' 'strict-dynamic' https://challenges.cloudflare.com`)
    expect(csp).toContain(`frame-ancestors 'none'`)
    expect(csp).toContain(`object-src 'none'`)
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).not.toContain('unsafe-eval')
    const terceros = csp.match(/https:\/\/[^\s;]+/g) ?? []
    expect(new Set(terceros)).toEqual(new Set(['https://challenges.cloudflare.com']))
  })

  it('genera nonces distintos de 128 bits', () => {
    const a = generarNonce()
    expect(a).not.toBe(generarNonce())
    expect(atob(a)).toHaveLength(16)
  })
})

describe('Basic auth del webhook', () => {
  const cabecera = (u: string, c: string) => `Basic ${Buffer.from(`${u}:${c}`).toString('base64')}`
  it('acepta solo las credenciales exactas', () => {
    expect(basicAuthValido(cabecera('openpay', 'secreto-largo'), 'openpay', 'secreto-largo')).toBe(true)
    expect(basicAuthValido(cabecera('openpay', 'otro'), 'openpay', 'secreto-largo')).toBe(false)
    expect(basicAuthValido(null, 'openpay', 'secreto-largo')).toBe(false)
    expect(basicAuthValido('Bearer x', 'openpay', 'secreto-largo')).toBe(false)
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
  })
})
