import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseDatos } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import * as schema from '@/server/db/schema'
import { Actor } from '@/shared/domain/actor'
import { codificarCursor } from '@/shared/domain/paginacion'
import { crearRegistroAuditoriaPostgres } from './registro-auditoria-postgres'

type Consulta = { sql: string; params: unknown[] }

const { obtenerDbMock } = vi.hoisted(() => ({
  obtenerDbMock: vi.fn<() => BaseDatos>(),
}))

vi.mock('@/server/db/cliente', () => ({
  obtenerDb: obtenerDbMock,
}))

function crearDbInstrumentada(respondedor: (sql: string, params: unknown[]) => unknown[]) {
  const consultas: Consulta[] = []
  const unsafe = (query: string, params: unknown[] = []) => {
    consultas.push({ sql: query, params })
    const filas = respondedor(query, params)
    return Object.assign(Promise.resolve(filas), {
      values: async () => filas,
    })
  }
  const clienteFalso = {
    options: { parsers: {} as Record<string, unknown>, serializers: {} as Record<string, unknown> },
    unsafe,
    begin: async <T>(cb: (txClient: { unsafe: typeof unsafe }) => Promise<T>) => cb({ unsafe }),
  }
  const db = drizzle(clienteFalso as unknown as Sql, { schema })
  return { db, consultas }
}

const ADMIN = new Actor(
  '11111111-1111-4111-8111-111111111111',
  'Admin Test',
  'admin@proinserco.test',
  'administrador',
  ['auditoria:leer'],
  'aal2',
)

const UUID_1 = '00000000-0000-4000-8000-000000000001'
const UUID_2 = '00000000-0000-4000-8000-000000000002'
const FECHA_1 = new Date('2026-11-16T15:00:00.000Z')
const FECHA_2 = new Date('2026-11-16T14:59:00.000Z')

describe('crearRegistroAuditoriaPostgres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserta validando EventoAuditable y normalizando IP desconocida a null con respaldo sistema', async () => {
    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRegistroAuditoriaPostgres()
    await repo.insertar({
      id: UUID_1,
      ocurridoEn: FECHA_1,
      accion: 'sesion.fallida',
      actorId: 'desconocido',
      recurso: 'sesion',
      recursoId: null,
      ip: 'desconocida',
      detalles: { motivo: 'credenciales' },
    })

    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_sistema')
    expect(consultas[1]?.sql).toContain('insert into "auditoria"')
    expect(consultas[1]?.params).toContain(UUID_1)
    expect(consultas[1]?.params).toContain(null)
  })

  it('respeta el contexto activo de panel en insertar y exige contexto en listar', async () => {
    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRegistroAuditoriaPostgres()

    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.insertar({
        id: UUID_1,
        ocurridoEn: FECHA_1,
        accion: 'donante.dato_revelado',
        actorId: ADMIN.usuarioId,
        recurso: 'donante',
        recursoId: UUID_2,
        ip: '192.0.2.5',
        detalles: { campo: 'correo' },
      }),
    )

    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_panel')
    expect(consultas[2]?.sql).toContain('insert into "auditoria"')
    expect(consultas[2]?.params).toContain('192.0.2.5')

    await expect(repo.listar({}, { limite: 20 })).rejects.toThrow('Contexto de base de datos requerido')
  })

  it('lista con filtros, total con COUNT(*), paginación por cursor keyset y descarta cursor corrupto', async () => {
    const fila1 = [UUID_1, FECHA_1.toISOString(), 'sesion.iniciada', ADMIN.usuarioId, 'sesion', null, '192.0.2.1', { ok: true }]
    const fila2 = [UUID_2, FECHA_2.toISOString(), 'sesion.iniciada', ADMIN.usuarioId, 'sesion', null, null, { ok: true }]

    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('count(*)')) return [[5]]
      if (sql.includes('from "auditoria"')) return [fila1, fila2]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRegistroAuditoriaPostgres()
    const cursorValido = codificarCursor({ en: '2026-11-16T15:05:00.000Z', id: UUID_2 })

    const pagina = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.listar(
        {
          accion: 'sesion.iniciada',
          actorId: ADMIN.usuarioId,
          recurso: 'sesion',
          desde: new Date('2026-11-16T00:00:00.000Z'),
          hasta: new Date('2026-11-16T23:59:59.000Z'),
        },
        { limite: 1, cursor: cursorValido },
      ),
    )

    expect(pagina.total).toBe(5)
    expect(pagina.elementos).toHaveLength(1)
    expect(pagina.elementos[0]?.id).toBe(UUID_1)
    expect(pagina.cursorSiguiente).toBe(codificarCursor({ en: FECHA_1.toISOString(), id: UUID_1 }))

    const selectPagina = consultas.find((c) => c.sql.includes('order by "auditoria"."ocurrido_en" desc'))
    expect(selectPagina?.sql).toContain('("auditoria"."ocurrido_en", "auditoria"."id") < ($')
    expect(selectPagina?.sql).toContain('limit $')
    expect(selectPagina?.params).toContain(2)

    consultas.length = 0
    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.listar({}, { limite: 10, cursor: 'basura-no-uuid' }))
    const sinCursor = consultas.find((c) => c.sql.includes('order by "auditoria"."ocurrido_en" desc'))
    expect(sinCursor?.sql).not.toContain('("auditoria"."ocurrido_en", "auditoria"."id") <')
  })
})
