import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseDatos } from '@/server/db/cliente'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import * as schema from '@/server/db/schema'
import { Actor } from '@/shared/domain/actor'
import { importeDesdePesos } from '@/shared/domain/importe'
import { codificarCursor } from '@/shared/domain/paginacion'
import { Donacion, type DonacionId } from '../domain/donacion'
import { crearRepositorioDonacionesPostgres } from './repositorio-donaciones-postgres'

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
  ['donaciones:leer'],
  'aal2',
)

const UUID_1 = '00000000-0000-4000-8000-000000000001'
const UUID_2 = '00000000-0000-4000-8000-000000000002'
const DONANTE_UUID = '00000000-0000-4000-8000-000000000010'
const CLAVE_UUID = '00000000-0000-4000-8000-000000000020'
const REF_1 = 'DON-000000000000000000001'
const REF_2 = 'DON-000000000000000000002'
const FECHA_1 = new Date('2026-11-16T15:00:00.000Z')
const FECHA_2 = new Date('2026-11-16T15:05:00.000Z')

function filaDonacionCruda(id: string, referencia: string, estado: string, centavos: string, fecha: Date) {
  return [
    id,
    referencia,
    CLAVE_UUID,
    estado,
    centavos,
    'COP',
    'educacion',
    DONANTE_UUID,
    'Ana',
    'Muñoz',
    'ana@demo.test',
    true,
    'chg_123',
    'https://sandbox.openpay.co/pay/123',
    'card',
    fecha.toISOString(),
    fecha.toISOString(),
  ]
}

describe('crearRepositorioDonacionesPostgres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('insertar persiste en modo público sin mutar entidad y con bigint', async () => {
    const { db, consultas } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonacionesPostgres()
    const donacion = Donacion.crear(
      {
        id: UUID_1 as DonacionId,
        referencia: REF_1,
        claveIdempotencia: CLAVE_UUID,
        importe: importeDesdePesos(50_000),
        linea: 'educacion',
        donanteId: DONANTE_UUID,
        pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
        quiereCertificado: true,
      },
      FECHA_1,
    )

    await repo.insertar(donacion)

    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_publico')
    expect(consultas[1]?.sql).toContain('insert into "donaciones"')
    expect(consultas[1]?.params).toContain(5_000_000n)
    expect(donacion.estado).toBe('creada')
  })

  it('actualizarSiEstado inserta transición solo si la fila coincidió con estadoEsperado', async () => {
    const base = Donacion.crear(
      {
        id: UUID_1 as DonacionId,
        referencia: REF_1,
        claveIdempotencia: CLAVE_UUID,
        importe: importeDesdePesos(50_000),
        linea: 'educacion',
        donanteId: DONANTE_UUID,
        pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
        quiereCertificado: true,
      },
      FECHA_1,
    ).registrarCargo('chg_123', 'https://sandbox.openpay.co/pay/123', FECHA_2)

    const { db: dbExito, consultas: consultasExito } = crearDbInstrumentada((sql) => {
      if (sql.includes('update "donaciones"')) return [[UUID_1]]
      return []
    })
    obtenerDbMock.mockReturnValue(dbExito)

    const repo = crearRepositorioDonacionesPostgres()
    expect(await repo.actualizarSiEstado(base, 'creada')).toBe(true)
    expect(consultasExito[0]?.sql).toBe('SET LOCAL ROLE proinserco_sistema')
    expect(consultasExito.some((c) => c.sql.includes('insert into "donaciones_transiciones"'))).toBe(true)

    const { db: dbPerdida, consultas: consultasPerdida } = crearDbInstrumentada(() => [])
    obtenerDbMock.mockReturnValue(dbPerdida)
    expect(await repo.actualizarSiEstado(base, 'creada')).toBe(false)
    expect(consultasPerdida.some((c) => c.sql.includes('insert into "donaciones_transiciones"'))).toBe(false)
  })

  it('buscarPorId y buscarPorClaveIdempotencia rechazan no-UUID sin consultar y reconstruyen historial', async () => {
    const fila = filaDonacionCruda(UUID_1, REF_1, 'pendiente', '5000000', FECHA_1)
    const transicion = [UUID_2, UUID_1, 'creada', 'pendiente', FECHA_2.toISOString(), 'servidor']

    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('from "donaciones"')) return [fila]
      if (sql.includes('from "donaciones_transiciones"')) return [transicion]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonacionesPostgres()
    expect(await repo.buscarPorId('invalido')).toBeNull()
    expect(await repo.buscarPorClaveIdempotencia('invalido')).toBeNull()
    expect(consultas).toHaveLength(0)

    const encontrada = await repo.buscarPorReferencia(REF_1)
    expect(encontrada?.datos.importe).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
    expect(encontrada?.datos.historial).toEqual([{ desde: 'creada', hacia: 'pendiente', en: FECHA_2, origen: 'servidor' }])
  })

  it('listar soporta filtros, ordenación por monto/estado/fecha, cursor keyset y carga en lote sin N+1', async () => {
    const f1 = filaDonacionCruda(UUID_1, REF_1, 'aprobada', '1000000', FECHA_1)
    const f2 = filaDonacionCruda(UUID_2, REF_2, 'pendiente', '5000000', FECHA_2)
    const t1 = ['00000000-0000-4000-8000-000000000099', UUID_1, 'creada', 'pendiente', FECHA_1.toISOString(), 'servidor']

    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('count(*)')) return [[2]]
      if (sql.includes('from "donaciones"')) return [f1, f2]
      if (sql.includes('from "donaciones_transiciones"')) return [t1]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonacionesPostgres()
    const cursorMonto = codificarCursor({ en: '00000000000000500000', id: UUID_2, o: 'monto:asc' })

    const pagina = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.listar(
        {
          estado: 'aprobada',
          linea: 'educacion',
          minCentavos: 1_000_000n,
          maxCentavos: 5_000_000n,
          q: '50%_\\x',
          orden: 'monto',
          dir: 'asc',
        },
        { limite: 1, cursor: cursorMonto },
      ),
    )

    expect(pagina.total).toBe(2)
    expect(pagina.elementos).toHaveLength(1)
    expect(pagina.elementos[0]?.datos.historial).toHaveLength(1)
    expect(pagina.cursorSiguiente).toBe(codificarCursor({ en: '00000000000001000000', id: UUID_1, o: 'monto:asc' }))

    const selectDonaciones = consultas.find((c) => c.sql.includes('order by "donaciones"."importe_centavos" asc'))
    expect(selectDonaciones?.sql).toContain('("donaciones"."importe_centavos", "donaciones"."id") >')
    expect(selectDonaciones?.sql).toContain('"donaciones"."referencia" ilike')
    expect(selectDonaciones?.sql).toContain('lower("donaciones"."pagador_correo") ILIKE')
    expect(selectDonaciones?.params).toContain('%50\\%\\_\\\\x%')

    // Cambio de criterio de orden ignora cursor anterior sin fallar
    consultas.length = 0
    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.listar({ orden: 'estado', dir: 'desc' }, { limite: 10, cursor: cursorMonto }),
    )
    const cambioOrden = consultas.find((c) => c.sql.includes('order by "donaciones"."estado" desc, "donaciones"."id" desc'))
    expect(cambioOrden).toBeDefined()
    expect(cambioOrden?.sql).not.toContain('("donaciones"."estado", "donaciones"."id")')

    // Solo una consulta de transiciones en lote para listarDesde
    consultas.length = 0
    const desde = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.listarDesde(FECHA_1))
    expect(desde).toHaveLength(2)
    expect(consultas.filter((c) => c.sql.includes('from "donaciones_transiciones"'))).toHaveLength(1)

    // Orden por estado asc con cursor válido
    const cursorEstado = codificarCursor({ en: 'aprobada', id: UUID_1, o: 'estado:asc' })
    consultas.length = 0
    await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () =>
      repo.listar({ orden: 'estado', dir: 'asc' }, { limite: 10, cursor: cursorEstado }),
    )
    const selectEstado = consultas.find((c) => c.sql.includes('order by "donaciones"."estado" asc, "donaciones"."id" asc'))
    expect(selectEstado?.sql).toContain('("donaciones"."estado", "donaciones"."id") >')

    // Si no hay donaciones en la página, no consulta donaciones_transiciones
    const { db: dbVacia, consultas: consultasVacias } = crearDbInstrumentada((sql) => {
      if (sql.includes('count(*)')) return [[0]]
      return []
    })
    obtenerDbMock.mockReturnValue(dbVacia)
    const vacia = await ejecutarConContextoDb({ modo: 'panel', actor: ADMIN }, () => repo.listar({}, { limite: 10 }))
    expect(vacia).toEqual({ elementos: [], cursorSiguiente: null, total: 0 })
    expect(consultasVacias.some((c) => c.sql.includes('from "donaciones_transiciones"'))).toBe(false)
  })

  it('buscarPorIdCargo usa modo sistema e insertar rechaza no-UUID sin abrir transacción', async () => {
    const fila = filaDonacionCruda(UUID_1, REF_1, 'pendiente', '5000000', FECHA_1)
    const { db, consultas } = crearDbInstrumentada((sql) => {
      if (sql.includes('from "donaciones"')) return [fila]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const repo = crearRepositorioDonacionesPostgres()
    const porCargo = await repo.buscarPorIdCargo('chg_123')
    expect(porCargo?.id).toBe(UUID_1)
    expect(consultas[0]?.sql).toBe('SET LOCAL ROLE proinserco_sistema')

    consultas.length = 0
    const invalida = Donacion.crear(
      {
        id: 'id-no-uuid' as DonacionId,
        referencia: REF_1,
        claveIdempotencia: CLAVE_UUID,
        importe: importeDesdePesos(10_000),
        linea: 'educacion',
        donanteId: DONANTE_UUID,
        pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
        quiereCertificado: false,
      },
      FECHA_1,
    )
    await expect(repo.insertar(invalida)).rejects.toThrow('UUID')
    expect(consultas).toHaveLength(0)
  })
})
