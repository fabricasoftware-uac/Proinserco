import { AsyncLocalStorage } from 'node:async_hooks'
import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Actor } from '@/shared/domain/actor'
import type { BaseDatos } from './db/cliente'
import { conTransaccionDb, type TransaccionDb } from './db/contexto-db'

const { estadoCache, obtenerActorContenedorMock, obtenerDbMock } = vi.hoisted(() => ({
  estadoCache: { actual: null as AsyncLocalStorage<Map<object, unknown>> | null },
  obtenerActorContenedorMock: vi.fn<() => Promise<Actor | null>>(),
  obtenerDbMock: vi.fn<() => BaseDatos>(),
}))

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => {
    const clave = {}
    return ((...args: Parameters<T>) => {
      const store = estadoCache.actual?.getStore()
      if (!store) return fn(...args)
      if (!store.has(clave)) store.set(clave, fn(...args))
      return store.get(clave) as ReturnType<T>
    }) as T
  },
}))

vi.mock('./container', () => ({
  obtenerContenedor: async () => ({
    iam: {
      obtenerActor: obtenerActorContenedorMock,
    },
  }),
}))

vi.mock('./cookies-next', () => ({
  almacenCookiesNext: async () => ({
    obtener: () => undefined,
    todas: () => [],
    establecer: () => undefined,
    eliminar: () => undefined,
  }),
}))

vi.mock('./db/cliente', () => ({
  obtenerDb: obtenerDbMock,
}))

import { obtenerActor, requireActor } from './auth-context'

const almacenamientoReactCache = new AsyncLocalStorage<Map<object, unknown>>()
estadoCache.actual = almacenamientoReactCache

const dialectoPg = new PgDialect()

function crearActorPrueba(id: string, rol: 'administrador' | 'consulta'): Actor {
  return new Actor(id, `Usuario ${rol}`, `${rol}@proinserco.test`, rol, ['panel:entrar', 'donaciones:leer'], 'aal2')
}

describe('auth-context + resolvedor de actor en Server Components', () => {
  let consultas: Array<{ sql: string; params: unknown[] }>

  beforeEach(() => {
    consultas = []
    const tx = {
      execute: vi.fn(async (consulta: SQLWrapper) => {
        const { sql, params } = dialectoPg.sqlToQuery(consulta.getSQL())
        consultas.push({ sql, params })
        return []
      }),
    } as unknown as TransaccionDb
    const db = {
      transaction: vi.fn(async <T>(cb: (txInterna: TransaccionDb) => Promise<T>) => cb(tx)),
    } as unknown as BaseDatos
    obtenerDbMock.mockReturnValue(db)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requireActor guarda el actor en React.cache y las consultas posteriores usan modo panel automáticamente', async () => {
    const actor = crearActorPrueba('11111111-1111-4111-8111-111111111111', 'administrador')
    obtenerActorContenedorMock.mockResolvedValueOnce(actor)

    await almacenamientoReactCache.run(new Map(), async () => {
      const resuelto = await requireActor('donaciones:leer')
      expect(resuelto).toBe(actor)
      // Segunda lectura en la misma petición reutiliza la caché sin reconsultar IAM
      expect(await obtenerActor()).toBe(actor)
      expect(obtenerActorContenedorMock).toHaveBeenCalledTimes(1)

      const resultado = await conTransaccionDb(async () => 'ok-rsc')
      expect(resultado).toBe('ok-rsc')
    })

    expect(consultas).toHaveLength(2)
    expect(consultas[0]).toEqual({ sql: 'SET LOCAL ROLE proinserco_panel', params: [] })
    expect(JSON.parse(String(consultas[1]?.params[0]))).toEqual({
      sub: actor.usuarioId,
      aal: 'aal2',
      app_metadata: { rol: 'administrador' },
    })
  })

  it('aísla el actor resuelto entre peticiones concurrentes', async () => {
    const actorA = crearActorPrueba('11111111-1111-4111-8111-111111111111', 'administrador')
    const actorB = crearActorPrueba('22222222-2222-4222-8222-222222222222', 'consulta')

    let turno = 0
    obtenerActorContenedorMock.mockImplementation(async () => {
      turno += 1
      return turno === 1 ? actorA : actorB
    })

    const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

    const [claimsA, claimsB] = await Promise.all([
      almacenamientoReactCache.run(new Map(), async () => {
        await requireActor()
        await esperar(15)
        await conTransaccionDb(async () => 'a')
        return JSON.parse(
          String(consultas.find((c) => c.params.length > 0 && String(c.params[0]).includes(actorA.usuarioId))?.params[0]),
        )
      }),
      almacenamientoReactCache.run(new Map(), async () => {
        await requireActor()
        await esperar(5)
        await conTransaccionDb(async () => 'b')
        return JSON.parse(
          String(consultas.find((c) => c.params.length > 0 && String(c.params[0]).includes(actorB.usuarioId))?.params[0]),
        )
      }),
    ])

    expect(claimsA).toEqual({ sub: actorA.usuarioId, aal: 'aal2', app_metadata: { rol: 'administrador' } })
    expect(claimsB).toEqual({ sub: actorB.usuarioId, aal: 'aal2', app_metadata: { rol: 'consulta' } })
  })
})
