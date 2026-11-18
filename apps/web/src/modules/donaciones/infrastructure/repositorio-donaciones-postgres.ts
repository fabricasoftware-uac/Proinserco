import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { escaparParaLike, esUuidValido, normalizarLimitePaginacion, parsearFechaCursor } from '@/server/db/consultas'
import { conTransaccionDb, type TransaccionDb } from '@/server/db/contexto-db'
import { donaciones, donacionesTransiciones, type FilaDonacion } from '@/server/db/schema'
import { type ClaveCursor, codificarCursor, decodificarCursor } from '@/shared/domain/paginacion'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'
import { Donacion, type DonacionId, type TransicionRegistrada } from '../domain/donacion'
import type { FiltrosDonaciones } from '../domain/esquemas'
import { EstadoDonacion } from '../domain/estado-donacion'

type Orden = NonNullable<FiltrosDonaciones['orden']>
type Dir = NonNullable<FiltrosDonaciones['dir']>

function aDonacion(fila: FilaDonacion, historial: readonly TransicionRegistrada[]): Donacion {
  return Donacion.reconstruir({
    id: fila.id as DonacionId,
    referencia: fila.referencia,
    claveIdempotencia: fila.claveIdempotencia,
    estado: fila.estado,
    importe: { centavos: fila.importeCentavos, moneda: fila.moneda },
    linea: fila.linea,
    donanteId: fila.donanteId,
    pagador: {
      nombres: fila.pagadorNombres,
      apellidos: fila.pagadorApellidos,
      correo: fila.pagadorCorreo,
    },
    quiereCertificado: fila.quiereCertificado,
    idCargo: fila.idCargo,
    urlPago: fila.urlPago,
    metodoPago: fila.metodoPago,
    creadaEn: fila.creadaEn,
    actualizadaEn: fila.actualizadaEn,
    historial,
  })
}

async function cargarHistorialesPorDonacion(
  tx: TransaccionDb,
  donacionIds: readonly string[],
): Promise<Map<string, TransicionRegistrada[]>> {
  const mapa = new Map<string, TransicionRegistrada[]>()
  if (donacionIds.length === 0) return mapa

  const filas = await tx
    .select()
    .from(donacionesTransiciones)
    .where(inArray(donacionesTransiciones.donacionId, [...donacionIds]))
    .orderBy(asc(donacionesTransiciones.en), asc(donacionesTransiciones.id))

  for (const t of filas) {
    const lista = mapa.get(t.donacionId) ?? []
    lista.push({ desde: t.desde, hacia: t.hacia, en: t.en, origen: t.origen })
    mapa.set(t.donacionId, lista)
  }
  return mapa
}

async function buscarUnica(tx: TransaccionDb, condicion: SQL): Promise<Donacion | null> {
  const [fila] = await tx.select().from(donaciones).where(condicion).limit(1)
  if (!fila) return null
  const historiales = await cargarHistorialesPorDonacion(tx, [fila.id])
  return aDonacion(fila, historiales.get(fila.id) ?? [])
}

function claveDeFila(fila: FilaDonacion, orden: Orden, dir: Dir): ClaveCursor {
  const en =
    orden === 'monto'
      ? fila.importeCentavos.toString().padStart(20, '0')
      : orden === 'estado'
        ? fila.estado
        : fila.creadaEn.toISOString()
  return { en, id: fila.id, o: `${orden}:${dir}` }
}

function comparacionKeyset<T>(colPrincipal: PgColumn, valorPrincipal: T, idCursor: string, dir: Dir): SQL {
  const izq = sql`(${colPrincipal}, ${donaciones.id})`
  const der = sql`(${sql.param(valorPrincipal, colPrincipal)}, ${sql.param(idCursor, donaciones.id)})`
  return dir === 'asc' ? sql`${izq} > ${der}` : sql`${izq} < ${der}`
}

function construirCondicionCursor(cursorCodificado: string | undefined, orden: Orden, dir: Dir): SQL | undefined {
  const decodificado = decodificarCursor(cursorCodificado)
  const criterio = `${orden}:${dir}`
  if (!decodificado || decodificado.o !== criterio || !esUuidValido(decodificado.id)) {
    return undefined
  }

  if (orden === 'fecha') {
    const fecha = parsearFechaCursor(decodificado.en)
    return fecha ? comparacionKeyset(donaciones.creadaEn, fecha, decodificado.id, dir) : undefined
  }

  if (orden === 'monto') {
    if (!/^\d+$/.test(decodificado.en)) return undefined
    return comparacionKeyset(donaciones.importeCentavos, BigInt(decodificado.en), decodificado.id, dir)
  }

  const estado = EstadoDonacion.safeParse(decodificado.en)
  return estado.success ? comparacionKeyset(donaciones.estado, estado.data, decodificado.id, dir) : undefined
}

function construirOrderBy(orden: Orden, dir: Dir) {
  const sentido = dir === 'asc' ? asc : desc
  switch (orden) {
    case 'monto':
      return [sentido(donaciones.importeCentavos), sentido(donaciones.id)]
    case 'estado':
      return [sentido(donaciones.estado), sentido(donaciones.id)]
    case 'fecha':
      return [sentido(donaciones.creadaEn), sentido(donaciones.id)]
  }
}

/**
 * Repositorio PostgreSQL de donaciones sobre `public.donaciones` y
 * `public.donaciones_transiciones`.
 */
export function crearRepositorioDonacionesPostgres(): RepositorioDonaciones {
  return {
    async insertar(donacion) {
      const d = donacion.datos
      if (!esUuidValido(d.id) || !esUuidValido(d.claveIdempotencia) || !esUuidValido(d.donanteId)) {
        throw new Error('Identificadores de donación inválidos: se requieren UUIDs')
      }

      await conTransaccionDb(
        async (tx) => {
          await tx.insert(donaciones).values({
            id: d.id,
            referencia: d.referencia,
            claveIdempotencia: d.claveIdempotencia,
            estado: d.estado,
            importeCentavos: d.importe.centavos,
            moneda: d.importe.moneda,
            linea: d.linea,
            donanteId: d.donanteId,
            pagadorNombres: d.pagador.nombres,
            pagadorApellidos: d.pagador.apellidos,
            pagadorCorreo: d.pagador.correo,
            quiereCertificado: d.quiereCertificado,
            idCargo: d.idCargo,
            urlPago: d.urlPago,
            metodoPago: d.metodoPago,
            creadaEn: d.creadaEn,
            actualizadaEn: d.actualizadaEn,
          })
        },
        { modo: 'publico' },
      )
    },

    async actualizarSiEstado(donacion, estadoEsperado) {
      const d = donacion.datos
      if (!esUuidValido(d.id)) return false

      return conTransaccionDb(
        async (tx) => {
          const actualizadas = await tx
            .update(donaciones)
            .set({
              estado: d.estado,
              idCargo: d.idCargo,
              urlPago: d.urlPago,
              metodoPago: d.metodoPago,
              actualizadaEn: d.actualizadaEn,
            })
            .where(and(eq(donaciones.id, d.id), eq(donaciones.estado, estadoEsperado)))
            .returning({ id: donaciones.id })

          if (actualizadas.length !== 1) return false

          const ultimaTransicion = d.historial.at(-1)
          if (ultimaTransicion) {
            await tx.insert(donacionesTransiciones).values({
              donacionId: d.id,
              desde: ultimaTransicion.desde,
              hacia: ultimaTransicion.hacia,
              en: ultimaTransicion.en,
              origen: ultimaTransicion.origen,
            })
          }

          return true
        },
        { modo: 'sistema' },
      )
    },

    async buscarPorId(id) {
      if (!esUuidValido(id)) return null
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.id, id)), { modo: 'sistema' })
    },

    async buscarPorReferencia(referencia) {
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.referencia, referencia)), { modo: 'publico' })
    },

    async buscarPorIdCargo(idCargo) {
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.idCargo, idCargo)), { modo: 'sistema' })
    },

    async buscarPorClaveIdempotencia(clave) {
      if (!esUuidValido(clave)) return null
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.claveIdempotencia, clave)), { modo: 'publico' })
    },

    async listar(filtros, paginacion) {
      const limite = normalizarLimitePaginacion(paginacion.limite)
      const orden: Orden = filtros.orden ?? 'fecha'
      const dir: Dir = filtros.dir ?? 'desc'

      const condiciones: SQL[] = []
      if (filtros.estado) condiciones.push(eq(donaciones.estado, filtros.estado))
      if (filtros.linea) condiciones.push(eq(donaciones.linea, filtros.linea))
      if (filtros.desde) condiciones.push(gte(donaciones.creadaEn, filtros.desde))
      if (filtros.hasta) condiciones.push(lte(donaciones.creadaEn, filtros.hasta))
      if (filtros.minCentavos !== undefined) condiciones.push(gte(donaciones.importeCentavos, filtros.minCentavos))
      if (filtros.maxCentavos !== undefined) condiciones.push(lte(donaciones.importeCentavos, filtros.maxCentavos))

      const texto = filtros.q?.trim()
      if (texto) {
        const patron = `%${escaparParaLike(texto)}%`
        const busqueda = or(
          ilike(donaciones.referencia, patron),
          sql`lower(${donaciones.pagadorCorreo}) ILIKE ${patron.toLowerCase()}`,
        )
        if (busqueda) condiciones.push(busqueda)
      }

      const condicionCursor = construirCondicionCursor(paginacion.cursor, orden, dir)
      const whereFiltros = condiciones.length > 0 ? and(...condiciones) : undefined
      const wherePagina = condicionCursor ? (whereFiltros ? and(whereFiltros, condicionCursor) : condicionCursor) : whereFiltros

      return conTransaccionDb(async (tx) => {
        const [conteo] = await tx.select({ total: count() }).from(donaciones).where(whereFiltros)
        const filas = await tx
          .select()
          .from(donaciones)
          .where(wherePagina)
          .orderBy(...construirOrderBy(orden, dir))
          .limit(limite + 1)

        const hayMas = filas.length > limite
        const visibles = hayMas ? filas.slice(0, limite) : filas
        const historiales = await cargarHistorialesPorDonacion(
          tx,
          visibles.map((f) => f.id),
        )
        const ultimo = visibles.at(-1)

        return {
          elementos: visibles.map((f) => aDonacion(f, historiales.get(f.id) ?? [])),
          cursorSiguiente: hayMas && ultimo ? codificarCursor(claveDeFila(ultimo, orden, dir)) : null,
          total: Number(conteo?.total ?? 0),
        }
      })
    },

    async listarDesde(desde) {
      return conTransaccionDb(async (tx) => {
        const filas = await tx
          .select()
          .from(donaciones)
          .where(gte(donaciones.creadaEn, desde))
          .orderBy(desc(donaciones.creadaEn), desc(donaciones.id))

        const historiales = await cargarHistorialesPorDonacion(
          tx,
          filas.map((f) => f.id),
        )
        return filas.map((f) => aDonacion(f, historiales.get(f.id) ?? []))
      })
    },
  }
}
