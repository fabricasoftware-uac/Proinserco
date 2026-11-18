import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Actor } from '@/shared/domain/actor'
import { NoAutenticado } from '@/shared/domain/errores'
import type { BaseDatos } from './cliente'
import { escaparParaLike, esUuidValido, normalizarLimitePaginacion, parsearFechaCursor } from './consultas'
import {
  type ContextoDb,
  conTransaccionDb,
  ejecutarConContextoDb,
  normalizarIpParaInet,
  obtenerContextoDb,
  registrarResolvedorActorPanel,
  type TransaccionDb,
} from './contexto-db'

type ConsultaCapturada = {
  sql: string
  params: unknown[]
}

const { obtenerDbMock } = vi.hoisted(() => ({
  obtenerDbMock: vi.fn<() => BaseDatos>(),
}))

vi.mock('./cliente', () => ({
  obtenerDb: obtenerDbMock,
}))

const dialectoPg = new PgDialect()

function crearMockDb(consultas: ConsultaCapturada[], ordenEventos: string[]) {
  const tx = {
    execute: vi.fn(async (consulta: SQLWrapper) => {
      const { sql, params } = dialectoPg.sqlToQuery(consulta.getSQL())
      consultas.push({ sql, params })
      ordenEventos.push(`execute:${sql}`)
      return []
    }),
  } as unknown as TransaccionDb

  const db = {
    transaction: vi.fn(async <T>(cb: (txInterna: TransaccionDb) => Promise<T>) => cb(tx)),
  } as unknown as BaseDatos

  return { db, tx }
}

function crearActor(nivel: 'aal1' | 'aal2', rol = 'administrador'): Actor {
  return new Actor(
    '11111111-1111-4111-8111-111111111111',
    'Ana María Muñoz',
    'ana.munoz@proinserco.test',
    rol,
    ['panel:entrar', 'donaciones:leer'],
    nivel,
  )
}

describe('normalizarIpParaInet', () => {
  it('conserva IPv4 válidas y recorta espacios exteriores', () => {
    expect(normalizarIpParaInet('192.0.2.10')).toBe('192.0.2.10')
    expect(normalizarIpParaInet(' 192.0.2.10 ')).toBe('192.0.2.10')
    expect(normalizarIpParaInet('127.0.0.1')).toBe('127.0.0.1')
  })

  it('conserva IPv6 válidas y recorta espacios exteriores', () => {
    expect(normalizarIpParaInet('2001:db8::1')).toBe('2001:db8::1')
    expect(normalizarIpParaInet(' 2001:db8::1 ')).toBe('2001:db8::1')
    expect(normalizarIpParaInet('::1')).toBe('::1')
    expect(normalizarIpParaInet('::ffff:192.0.2.10')).toBe('::ffff:192.0.2.10')
  })

  it('retorna null para valores vacíos, centinelas o IPs inválidas para inet', () => {
    expect(normalizarIpParaInet('desconocida')).toBeNull()
    expect(normalizarIpParaInet(' desconocida ')).toBeNull()
    expect(normalizarIpParaInet(null)).toBeNull()
    expect(normalizarIpParaInet(undefined)).toBeNull()
    expect(normalizarIpParaInet('')).toBeNull()
    expect(normalizarIpParaInet('   ')).toBeNull()
    expect(normalizarIpParaInet('999.999.999.999')).toBeNull()
    expect(normalizarIpParaInet('not-an-ip')).toBeNull()
    expect(normalizarIpParaInet('192.0.2.10:8080')).toBeNull()
    expect(normalizarIpParaInet('[2001:db8::1]:443')).toBeNull()
    expect(normalizarIpParaInet('192.0.2.10/24')).toBeNull()
  })
})

describe('ejecutarConContextoDb y obtenerContextoDb', () => {
  it('devuelve undefined fuera de cualquier contexto', () => {
    expect(obtenerContextoDb()).toBeUndefined()
  })

  it('expone el contexto exacto dentro de ejecutarConContextoDb y lo limpia al salir o fallar', async () => {
    const actor = crearActor('aal2')
    const contextoPanel: ContextoDb = { modo: 'panel', actor }

    const capturado = await ejecutarConContextoDb(contextoPanel, async () => {
      await Promise.resolve()
      return obtenerContextoDb()
    })

    expect(capturado).toEqual(contextoPanel)
    expect(obtenerContextoDb()).toBeUndefined()

    await expect(
      ejecutarConContextoDb({ modo: 'sistema' }, async () => {
        expect(obtenerContextoDb()).toEqual({ modo: 'sistema' })
        throw new Error('fallo controlado')
      }),
    ).rejects.toThrow('fallo controlado')

    expect(obtenerContextoDb()).toBeUndefined()
  })

  it('restaura el contexto exterior cuando se anidan llamadas', async () => {
    const externo: ContextoDb = { modo: 'publico' }
    const interno: ContextoDb = { modo: 'sistema' }

    await ejecutarConContextoDb(externo, async () => {
      expect(obtenerContextoDb()).toEqual(externo)
      await ejecutarConContextoDb(interno, async () => {
        expect(obtenerContextoDb()).toEqual(interno)
      })
      expect(obtenerContextoDb()).toEqual(externo)
    })

    expect(obtenerContextoDb()).toBeUndefined()
  })

  it('aísla flujos concurrentes con Promise.all', async () => {
    const actorAdmin = crearActor('aal2', 'administrador')
    const actorConsulta = new Actor(
      '33333333-3333-4333-8333-333333333333',
      'Carlos Ruiz',
      'carlos@proinserco.test',
      'consulta',
      ['panel:entrar'],
      'aal2',
    )

    const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    const [resPublico, resSistema, resAdmin, resConsulta] = await Promise.all([
      ejecutarConContextoDb({ modo: 'publico' }, async () => {
        const inicio = obtenerContextoDb()
        await esperar(15)
        return { inicio, fin: obtenerContextoDb() }
      }),
      ejecutarConContextoDb({ modo: 'sistema' }, async () => {
        const inicio = obtenerContextoDb()
        await esperar(5)
        return { inicio, fin: obtenerContextoDb() }
      }),
      ejecutarConContextoDb({ modo: 'panel', actor: actorAdmin }, async () => {
        const inicio = obtenerContextoDb()
        await esperar(10)
        return { inicio, fin: obtenerContextoDb() }
      }),
      ejecutarConContextoDb({ modo: 'panel', actor: actorConsulta }, async () => {
        const inicio = obtenerContextoDb()
        await esperar(1)
        return { inicio, fin: obtenerContextoDb() }
      }),
    ])

    expect(resPublico).toEqual({ inicio: { modo: 'publico' }, fin: { modo: 'publico' } })
    expect(resSistema).toEqual({ inicio: { modo: 'sistema' }, fin: { modo: 'sistema' } })
    expect(resAdmin).toEqual({ inicio: { modo: 'panel', actor: actorAdmin }, fin: { modo: 'panel', actor: actorAdmin } })
    expect(resConsulta).toEqual({
      inicio: { modo: 'panel', actor: actorConsulta },
      fin: { modo: 'panel', actor: actorConsulta },
    })
    expect(obtenerContextoDb()).toBeUndefined()
  })
})

describe('conTransaccionDb', () => {
  let consultas: ConsultaCapturada[]
  let ordenEventos: string[]

  beforeEach(() => {
    consultas = []
    ordenEventos = []
    const { db } = crearMockDb(consultas, ordenEventos)
    obtenerDbMock.mockImplementation(() => db)
  })

  afterEach(() => {
    registrarResolvedorActorPanel(null)
  })

  it('falla cerrado sin contexto activo ni contextoRespaldo sin abrir transacción', async () => {
    const callback = vi.fn(async () => 'nunca')

    await expect(conTransaccionDb(callback)).rejects.toThrow('Contexto de base de datos requerido')
    expect(obtenerDbMock).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('rechaza actor de panel con nivel aal1 lanzando NoAutenticado sin abrir transacción', async () => {
    const actorAal1 = crearActor('aal1')
    const callback = vi.fn(async () => 'nunca')

    await expect(ejecutarConContextoDb({ modo: 'panel', actor: actorAal1 }, () => conTransaccionDb(callback))).rejects.toThrow(
      NoAutenticado,
    )

    await expect(
      ejecutarConContextoDb({ modo: 'panel', actor: actorAal1 }, () => conTransaccionDb(callback, { modo: 'publico' })),
    ).rejects.toThrow(NoAutenticado)

    await expect(conTransaccionDb(callback, { modo: 'panel', actor: actorAal1 })).rejects.toThrow(NoAutenticado)

    expect(obtenerDbMock).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('aplica SET LOCAL ROLE proinserco_publico antes de ejecutar el callback en modo publico', async () => {
    const resultado = await ejecutarConContextoDb({ modo: 'publico' }, () =>
      conTransaccionDb(async (tx) => {
        expect(tx).toBeDefined()
        ordenEventos.push('fn')
        return 'ok-publico'
      }),
    )

    expect(resultado).toBe('ok-publico')
    expect(consultas).toEqual([{ sql: 'SET LOCAL ROLE proinserco_publico', params: [] }])
    expect(ordenEventos).toEqual(['execute:SET LOCAL ROLE proinserco_publico', 'fn'])
  })

  it('aplica SET LOCAL ROLE proinserco_sistema antes de ejecutar el callback en modo sistema', async () => {
    const resultado = await ejecutarConContextoDb({ modo: 'sistema' }, () =>
      conTransaccionDb(async () => {
        ordenEventos.push('fn')
        return 42
      }),
    )

    expect(resultado).toBe(42)
    expect(consultas).toEqual([{ sql: 'SET LOCAL ROLE proinserco_sistema', params: [] }])
    expect(ordenEventos).toEqual(['execute:SET LOCAL ROLE proinserco_sistema', 'fn'])
  })

  it('acepta contextoRespaldo cuando no hay AsyncLocalStorage activo', async () => {
    const resultado = await conTransaccionDb(
      async () => {
        ordenEventos.push('fn')
        return 'ok-respaldo'
      },
      { modo: 'sistema' },
    )

    expect(resultado).toBe('ok-respaldo')
    expect(consultas).toEqual([{ sql: 'SET LOCAL ROLE proinserco_sistema', params: [] }])
    expect(ordenEventos).toEqual(['execute:SET LOCAL ROLE proinserco_sistema', 'fn'])
  })

  it('prioriza el contexto activo sobre contextoRespaldo para evitar escalamiento o degradación accidental', async () => {
    await ejecutarConContextoDb({ modo: 'publico' }, () => conTransaccionDb(async () => 'ok', { modo: 'sistema' }))

    expect(consultas).toEqual([{ sql: 'SET LOCAL ROLE proinserco_publico', params: [] }])
  })

  it('aplica SET LOCAL ROLE proinserco_panel y set_config request.jwt.claims en modo panel con actor aal2', async () => {
    const actor = crearActor('aal2', 'consulta')

    const resultado = await ejecutarConContextoDb({ modo: 'panel', actor }, () =>
      conTransaccionDb(async () => {
        ordenEventos.push('fn')
        return 'ok-panel'
      }),
    )

    expect(resultado).toBe('ok-panel')
    expect(consultas).toHaveLength(2)
    expect(consultas[0]).toEqual({ sql: 'SET LOCAL ROLE proinserco_panel', params: [] })
    expect(consultas[1]?.sql).toBe("SELECT set_config('request.jwt.claims', $1, true)")
    expect(consultas[1]?.params).toHaveLength(1)

    const claims = JSON.parse(String(consultas[1]?.params[0]))
    expect(claims).toEqual({
      sub: actor.usuarioId,
      aal: 'aal2',
      app_metadata: { rol: 'consulta' },
    })
    expect(ordenEventos).toEqual([
      'execute:SET LOCAL ROLE proinserco_panel',
      "execute:SELECT set_config('request.jwt.claims', $1, true)",
      'fn',
    ])
  })

  it('propaga errores del callback después de configurar el rol local', async () => {
    await expect(
      ejecutarConContextoDb({ modo: 'publico' }, () =>
        conTransaccionDb(async () => {
          throw new Error('error de consulta')
        }),
      ),
    ).rejects.toThrow('error de consulta')

    expect(consultas).toEqual([{ sql: 'SET LOCAL ROLE proinserco_publico', params: [] }])
  })

  it('usa registrarResolvedorActorPanel como tercer respaldo en modo panel cuando no hay AsyncLocalStorage ni contextoRespaldo', async () => {
    const actor = crearActor('aal2', 'administrador')
    const resolvedor = vi.fn(async () => actor)
    registrarResolvedorActorPanel(resolvedor)

    const resultado = await conTransaccionDb(async () => {
      ordenEventos.push('fn')
      return 'ok-resolvedor'
    })

    expect(resultado).toBe('ok-resolvedor')
    expect(resolvedor).toHaveBeenCalledTimes(1)
    expect(consultas).toHaveLength(2)
    expect(consultas[0]).toEqual({ sql: 'SET LOCAL ROLE proinserco_panel', params: [] })
    expect(JSON.parse(String(consultas[1]?.params[0]))).toEqual({
      sub: actor.usuarioId,
      aal: 'aal2',
      app_metadata: { rol: 'administrador' },
    })
  })

  it('prioriza AsyncLocalStorage y contextoRespaldo sobre registrarResolvedorActorPanel', async () => {
    const actor = crearActor('aal2')
    const resolvedor = vi.fn(() => actor)
    registrarResolvedorActorPanel(resolvedor)

    await ejecutarConContextoDb({ modo: 'publico' }, () => conTransaccionDb(async () => 'ok'))
    await conTransaccionDb(async () => 'ok', { modo: 'sistema' })

    expect(resolvedor).not.toHaveBeenCalled()
    expect(consultas).toEqual([
      { sql: 'SET LOCAL ROLE proinserco_publico', params: [] },
      { sql: 'SET LOCAL ROLE proinserco_sistema', params: [] },
    ])
  })

  it('falla cerrado si el resolvedor devuelve null y rechaza actor aal1 del resolvedor', async () => {
    registrarResolvedorActorPanel(() => null)
    await expect(conTransaccionDb(async () => 'nunca')).rejects.toThrow('Contexto de base de datos requerido')

    registrarResolvedorActorPanel(() => crearActor('aal1'))
    await expect(conTransaccionDb(async () => 'nunca')).rejects.toThrow(NoAutenticado)
    expect(obtenerDbMock).not.toHaveBeenCalled()
  })
})

describe('utilidades SQL de consultas', () => {
  it('esUuidValido acepta UUID v4 en minúsculas/mayúsculas y rechaza cadenas inválidas o inyecciones', () => {
    expect(esUuidValido('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(esUuidValido('11111111-1111-4111-8111-11111111111A')).toBe(true)
    expect(esUuidValido('')).toBe(false)
    expect(esUuidValido('no-es-uuid')).toBe(false)
    expect(esUuidValido("' OR 1=1 --")).toBe(false)
    expect(esUuidValido('11111111-1111-4111-8111-111111111111 ')).toBe(false)
  })

  it('escaparParaLike neutraliza \\, % y _ sin alterar texto normal', () => {
    expect(escaparParaLike('100%_test\\ruta')).toBe('100\\%\\_test\\\\ruta')
    expect(escaparParaLike('ana.munoz@proinserco.org')).toBe('ana.munoz@proinserco.org')
  })

  it('normalizarLimitePaginacion acota entre 1 y 100 y cae al defecto ante NaN/Infinity', () => {
    expect(normalizarLimitePaginacion(undefined)).toBe(20)
    expect(normalizarLimitePaginacion(Number.NaN)).toBe(20)
    expect(normalizarLimitePaginacion(Number.POSITIVE_INFINITY)).toBe(20)
    expect(normalizarLimitePaginacion(0)).toBe(1)
    expect(normalizarLimitePaginacion(-15)).toBe(1)
    expect(normalizarLimitePaginacion(500)).toBe(100)
    expect(normalizarLimitePaginacion(25.9)).toBe(25)
  })

  it('parsearFechaCursor devuelve Date válida o null si está corrupta', () => {
    expect(parsearFechaCursor('2026-11-16T15:00:00.000Z')?.toISOString()).toBe('2026-11-16T15:00:00.000Z')
    expect(parsearFechaCursor('fecha-invalida')).toBeNull()
    expect(parsearFechaCursor('')).toBeNull()
  })
})
