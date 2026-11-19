import { createHash } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InstanciaMock = EventEmitter & {
  status: string
  eval: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}

const { construcciones } = vi.hoisted(() => ({
  construcciones: [] as Array<{ url: string; opciones: Record<string, unknown>; instancia: InstanciaMock }>,
}))

vi.mock('ioredis', async () => {
  const { EventEmitter: BaseEmitter } = await import('node:events')
  class RedisMock extends BaseEmitter {
    status = 'ready'
    eval = vi.fn()
    connect = vi.fn(async () => undefined)

    constructor(url: string, opciones: Record<string, unknown>) {
      super()
      construcciones.push({ url, opciones, instancia: this as unknown as InstanciaMock })
    }
  }
  return { default: RedisMock }
})

// Reimporta después del mock para usar RedisMock y configurable por test.
import { crearLimitadorRedis, timeoutsRedis } from './limitador-redis'

describe('crearLimitadorRedis', () => {
  beforeEach(() => {
    construcciones.length = 0
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('redis:// (red privada) usa timeouts de 200 ms, sin cola offline y 1 reintento', () => {
    crearLimitadorRedis('redis://redis.proinserco.internal:6379')

    expect(construcciones).toHaveLength(1)
    expect(construcciones[0]?.url).toBe('redis://redis.proinserco.internal:6379')
    expect(construcciones[0]?.opciones).toEqual({
      connectTimeout: 200,
      commandTimeout: 200,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    })
  })

  it('rediss:// (TLS gestionado, p. ej. Upstash) pasa la URL tal cual a ioredis y amplía los timeouts', () => {
    crearLimitadorRedis('rediss://default:secreto@eu1-ejemplo.upstash.io:6379')

    expect(construcciones[0]?.url).toBe('rediss://default:secreto@eu1-ejemplo.upstash.io:6379')
    expect(construcciones[0]?.opciones).toEqual({
      connectTimeout: 3000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    })
    expect(timeoutsRedis('REDISS://x:6379').tls).toBe(true)
    expect(timeoutsRedis('redis://x:6379')).toEqual({ conexionMs: 200, comandoMs: 200, tls: false })
  })

  it('ejecuta script Lua atómico, hashea :id:<valor> con SHA-256 y calcula restantes/reintento', async () => {
    const limitador = crearLimitadorRedis('redis://127.0.0.1:6379')
    const cliente = construcciones[0]?.instancia
    expect(cliente).toBeDefined()

    const correo = 'ana.munoz@proinserco.test'
    const hashEsperado = createHash('sha256').update(correo).digest('hex')

    cliente?.eval.mockResolvedValueOnce([1, 900]).mockResolvedValueOnce([5, 845]).mockResolvedValueOnce([6, 840])

    const r1 = await limitador.consumir(`iniciar-sesion:id:${correo}`, 5, 900)
    const r2 = await limitador.consumir(`iniciar-sesion:id:${correo}`, 5, 900)
    const r3 = await limitador.consumir(`iniciar-sesion:id:${correo}`, 5, 900)

    expect(r1).toEqual({ permitido: true, restantes: 4, reintentarEnSegundos: 0 })
    expect(r2).toEqual({ permitido: true, restantes: 0, reintentarEnSegundos: 0 })
    expect(r3).toEqual({ permitido: false, restantes: 0, reintentarEnSegundos: 840 })

    const llamada = cliente?.eval.mock.calls[0]
    expect(llamada?.[0]).toContain("redis.call('INCR', KEYS[1])")
    expect(llamada?.[0]).toContain("redis.call('EXPIRE', KEYS[1], ventana)")
    expect(llamada?.[0]).toContain("redis.call('TTL', KEYS[1])")
    expect(llamada?.[1]).toBe(1)
    expect(llamada?.[2]).toBe(`ratelimit:iniciar-sesion:id:${hashEsperado}`)
    expect(llamada?.[2]).not.toContain(correo)
    expect(llamada?.[3]).toBe('900')
  })

  it('falla cerrado en rutas críticas e invoca alFallar con clave sanitizada', async () => {
    const alFallar = vi.fn()
    const limitador = crearLimitadorRedis('redis://127.0.0.1:6379', { alFallar })
    const cliente = construcciones[0]?.instancia
    const error = new Error('Command timed out')
    cliente?.eval.mockRejectedValue(error)

    const rutasCriticas = [
      'iniciar-sesion:ip:203.0.113.10',
      'iniciar-sesion:id:secreto@proinserco.test',
      'verificar-mfa:usuario:11111111-1111-4111-8111-111111111111',
      'crear-donacion:ip:203.0.113.10',
      'exportar-donaciones:ip:203.0.113.10',
      'revelar-dato-donante:ip:203.0.113.10',
    ]

    for (const clave of rutasCriticas) {
      const res = await limitador.consumir(clave, 10, 300)
      expect(res).toEqual({ permitido: false, restantes: 0, reintentarEnSegundos: 300 })
    }

    const hashEsperado = createHash('sha256').update('secreto@proinserco.test').digest('hex')
    expect(alFallar).toHaveBeenCalledTimes(rutasCriticas.length)
    expect(alFallar).toHaveBeenNthCalledWith(2, error, `iniciar-sesion:id:${hashEsperado}`)
  })

  it('falla abierto solo para tráfico de respaldo como webhook-openpay:', async () => {
    const alFallar = vi.fn()
    const limitador = crearLimitadorRedis('redis://127.0.0.1:6379', { alFallar })
    const cliente = construcciones[0]?.instancia
    const error = new Error('ECONNREFUSED')
    cliente?.eval.mockRejectedValueOnce(error)

    const res = await limitador.consumir('webhook-openpay:ip:198.51.100.4', 60, 60)

    expect(res).toEqual({ permitido: true, restantes: 60, reintentarEnSegundos: 0 })
    expect(alFallar).toHaveBeenCalledWith(error, 'webhook-openpay:ip:198.51.100.4')

    // La página de resultado también: la consulta a la pasarela ya está limitada por donación en BD.
    cliente?.eval.mockRejectedValueOnce(error)
    expect((await limitador.consumir('resultado-donacion:ip:198.51.100.4', 60, 300)).permitido).toBe(true)
    // Login sigue fallando cerrado.
    cliente?.eval.mockRejectedValueOnce(error)
    expect((await limitador.consumir('iniciar-sesion:ip:198.51.100.4', 10, 900)).permitido).toBe(false)
  })

  it('espera la conexión inicial si está conectando y falla cerrado si agota 200 ms', async () => {
    vi.useFakeTimers()
    const alFallar = vi.fn()
    const limitador = crearLimitadorRedis('redis://127.0.0.1:6379', { alFallar })
    const cliente = construcciones[0]?.instancia
    expect(cliente).toBeDefined()

    if (!cliente) return

    // Caso 1: conecta antes de 200 ms -> continúa con eval()
    cliente.status = 'connecting'
    cliente.eval.mockResolvedValueOnce([1, 60])
    const promesaOk = limitador.consumir('iniciar-sesion:ip:127.0.0.1', 10, 60)
    cliente.status = 'ready'
    cliente.emit('ready')
    await expect(promesaOk).resolves.toEqual({ permitido: true, restantes: 9, reintentarEnSegundos: 0 })

    // Caso 2: no responde en 200 ms -> falla cerrado en ruta crítica
    cliente.status = 'connecting'
    const promesaTimeout = limitador.consumir('crear-donacion:ip:127.0.0.1', 5, 600)
    await vi.advanceTimersByTimeAsync(201)
    await expect(promesaTimeout).resolves.toEqual({ permitido: false, restantes: 0, reintentarEnSegundos: 600 })
    expect(alFallar).toHaveBeenCalledTimes(1)
  })

  it('trata respuestas malformadas del script Lua como fallo seguro (cerrado en rutas críticas, abierto en webhook)', async () => {
    const alFallar = vi.fn()
    const limitador = crearLimitadorRedis('redis://127.0.0.1:6379', { alFallar })
    const cliente = construcciones[0]?.instancia
    expect(cliente).toBeDefined()
    if (!cliente) return

    cliente.eval
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([0, 60])
      .mockResolvedValueOnce(['no-numero', 60])
      .mockResolvedValueOnce(['invalido'])

    for (const clave of [
      'iniciar-sesion:ip:198.51.100.1',
      'iniciar-sesion:id:',
      'crear-donacion:ip:198.51.100.1',
      'verificar-mfa:usuario:u1',
    ]) {
      const res = await limitador.consumir(clave, 5, 120)
      expect(res).toEqual({ permitido: false, restantes: 0, reintentarEnSegundos: 120 })
    }

    const respaldo = await limitador.consumir('webhook-openpay:ip:198.51.100.1', 60, 60)
    expect(respaldo).toEqual({ permitido: true, restantes: 60, reintentarEnSegundos: 0 })
    expect(alFallar).toHaveBeenCalledTimes(5)
  })
})
