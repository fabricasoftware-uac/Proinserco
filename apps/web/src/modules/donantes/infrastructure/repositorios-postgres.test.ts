import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseDatos } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import * as schema from '@/server/db/schema'
import { Actor } from '@/shared/domain/actor'
import { codificarCursor } from '@/shared/domain/paginacion'
import type { DonanteId } from '../domain/donante'
import { crearRegistroConsentimientosPostgres, crearRepositorioDonantesPostgres } from './repositorios-postgres'

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
  ['donantes:leer'],
  'aal2',
)

const UUID_1 = '00000000-0000-4000-8000-000000000001'
const UUID_2 = '00000000-0000-4000-8000-000000000002'
const FECHA_1 = new Date('2026-11-16T15:00:00.000Z')

describe('repositorios de donantes y consentimientos en Postgres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guardar ejecuta UPSERT por id en contexto público y buscarPorId rechaza no-UUID sin tocar la BD', async () => {
    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonantesPostgres()
    await repo.guardar({
      id: UUID_1 as DonanteId,
      nombres: 'Ana María',
      apellidos: 'Muñoz',
      tipoDocumento: 'CC',
      numeroDocumento: '1061000111',
      correo: 'ana@demo.test',
      celular: '+573001234567',
      quiereCertificado: true,
      creadoEn: FECHA_1,
      actualizadoEn: FECHA_1,
    })

    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_publico')
    expect(consultas[1]?.sql).toContain('insert into "donantes"')
    expect(consultas[1]?.sql).toContain('on conflict ("id") do update')

    consultas.length = 0
    expect(await repo.buscarPorId('no-es-uuid')).toBeNull()
    expect(consultas).toHaveLength(0)
  })

  it('listar escapa %, _ y \\ en q, usa el índice trigram, pagina por cursor y contar retorna total', async () => {
    const filaDonante = [
      UUID_1,
      'Ana',
      'Muñoz',
      'CC',
      '1061000111',
      'ana@demo.test',
      '+573001234567',
      true,
      FECHA_1.toISOString(),
      FECHA_1.toISOString(),
    ]

    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('count(*)')) return [[1]]
      if (sql.includes('from "donantes"')) return [filaDonante]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonantesPostgres()
    const pagina = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.listar({ q: '100%_test\\x' }, { limite: 10 }),
    )

    expect(pagina.total).toBe(1)
    expect(pagina.cursorSiguiente).toBeNull()
    expect(pagina.elementos[0]?.nombres).toBe('Ana')

    const consultaCount = consultas.find((c) => c.sql.includes('count(*)'))
    expect(consultaCount?.sql).toContain(
      '("donantes"."nombres" || \' \' || "donantes"."apellidos" || \' \' || "donantes"."correo") ILIKE $1',
    )
    expect(consultaCount?.params).toEqual(['%100\\%\\_test\\\\x%'])

    const cursor = codificarCursor({ en: FECHA_1.toISOString(), id: UUID_2 })
    consultas.length = 0
    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.listar({}, { limite: 1, cursor }))
    const consultaPagina = consultas.find((c) => c.sql.includes('order by "donantes"."creado_en" desc'))
    expect(consultaPagina?.sql).toContain('("donantes"."creado_en", "donantes"."id") <')
    expect(consultaPagina?.params).toContain(2)

    consultas.length = 0
    const total = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.contar())
    expect(total).toBe(1)
  })

  it('consentimientos inserta normalizando IP y lista por donante en orden ascendente (sin consultar si no es UUID)', async () => {
    const filaConsentimiento = [
      UUID_2,
      UUID_1,
      'ana@demo.test',
      'gestion_donacion',
      'v-2026',
      true,
      '192.0.2.10',
      'vitest',
      FECHA_1.toISOString(),
    ]
    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('from "consentimientos"')) return [filaConsentimiento]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const registro = crearRegistroConsentimientosPostgres()
    await registro.insertar({
      id: UUID_2,
      donanteId: UUID_1,
      correo: 'ana@demo.test',
      finalidad: 'gestion_donacion',
      versionTexto: 'v-2026',
      otorgada: true,
      ip: 'desconocida',
      userAgent: 'vitest',
      creadoEn: FECHA_1,
    })

    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_publico')
    expect(consultas[1]?.sql).toContain('insert into "consentimientos"')
    expect(consultas[1]?.params).toContain(null)

    consultas.length = 0
    expect(await registro.listarPorDonante('invalido')).toEqual([])
    expect(consultas).toHaveLength(0)

    const lista = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => registro.listarPorDonante(UUID_1))
    expect(lista).toHaveLength(1)
    expect(lista[0]?.ip).toBe('192.0.2.10')
    expect(consultas.find((c) => c.sql.includes('from "consentimientos"'))?.sql).toContain(
      'order by "consentimientos"."creado_en" asc, "consentimientos"."id" asc',
    )
  })

  it('buscarPorDocumento usa modo público, guardar/insertar rechazan no-UUID sin tocar BD y listar ignora cursor con id no-UUID', async () => {
    const filaDonante = [
      UUID_1,
      'Ana',
      'Muñoz',
      'CC',
      '1061000111',
      'ana@demo.test',
      '+573001234567',
      true,
      FECHA_1.toISOString(),
      FECHA_1.toISOString(),
    ]
    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('count(*)')) return [[1]]
      if (sql.includes('from "donantes"')) return [filaDonante]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonantesPostgres()
    const encontrado = await repo.buscarPorDocumento('CC', '1061000111')
    expect(encontrado?.id).toBe(UUID_1)
    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_publico')

    consultas.length = 0
    await expect(
      repo.guardar({
        id: 'no-uuid' as DonanteId,
        nombres: 'Ana',
        apellidos: 'Muñoz',
        tipoDocumento: 'CC',
        numeroDocumento: '1061000111',
        correo: 'ana@demo.test',
        celular: '+573001234567',
        quiereCertificado: false,
        creadoEn: FECHA_1,
        actualizadoEn: FECHA_1,
      }),
    ).rejects.toThrow('UUID')

    const registro = crearRegistroConsentimientosPostgres()
    await expect(
      registro.insertar({
        id: 'no-uuid',
        donanteId: UUID_1,
        correo: 'ana@demo.test',
        finalidad: 'gestion_donacion',
        versionTexto: 'v-1',
        otorgada: true,
        ip: null,
        userAgent: null,
        creadoEn: FECHA_1,
      }),
    ).rejects.toThrow('UUID')
    expect(consultas).toHaveLength(0)

    const cursorIdInvalido = codificarCursor({ en: FECHA_1.toISOString(), id: 'no-uuid' })
    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.listar({}, { limite: 10, cursor: cursorIdInvalido }))
    const selectSinCursor = consultas.find((c) => c.sql.includes('order by "donantes"."creado_en" desc'))
    expect(selectSinCursor?.sql).not.toContain('("donantes"."creado_en", "donantes"."id") <')
  })
})
