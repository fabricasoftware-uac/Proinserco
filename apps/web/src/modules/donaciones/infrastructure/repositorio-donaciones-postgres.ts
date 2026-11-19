import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { escaparParaLike, esUuidValido, normalizarLimitePaginacion, parsearFechaCursor } from '@/server/db/consultas'
import { conTransaccionDb, obtenerContextoDb, type TransaccionDb } from '@/server/db/contexto-db'
import { donaciones, donacionesTransiciones, type FilaDonacion } from '@/server/db/schema'
import { Moneda } from '@/shared/domain/importe'
import { type ClaveCursor, codificarCursor, decodificarCursor } from '@/shared/domain/paginacion'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'
import { Donacion, type DonacionId, type TransicionRegistrada } from '../domain/donacion'
import { type FiltrosDonaciones, ReferenciaDonacion } from '../domain/esquemas'
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

      if (d.estado !== 'creada' || d.idCargo || d.urlPago || d.metodoPago) {
        throw new Error('Solo se insertan donaciones en estado creada y sin cargo')
      }

      // Solo por la función acotada: `proinserco_publico` no tiene INSERT sobre la tabla.
      await conTransaccionDb(
        async (tx) => {
          await tx.execute(sql`
            SELECT public.crear_donacion_publica(
              ${d.id}::uuid, ${d.referencia}, ${d.claveIdempotencia}::uuid, ${d.importe.centavos.toString()}::bigint,
              ${d.importe.moneda}, ${d.linea}, ${d.donanteId}::uuid, ${d.pagador.nombres}, ${d.pagador.apellidos},
              ${d.pagador.correo}, ${d.quiereCertificado}, ${d.creadaEn.toISOString()}::timestamptz
            )`)
        },
        { modo: 'publico' },
      )
    },

    async actualizarSiEstado(donacion, estadoEsperado) {
      const d = donacion.datos
      if (!esUuidValido(d.id)) return false

      if (obtenerContextoDb()?.modo === 'publico') {
        // El flujo público solo registra el cargo recién creado (`creada` → `pendiente`).
        if (estadoEsperado !== 'creada' || d.estado !== 'pendiente' || !d.idCargo || !d.urlPago) {
          throw new Error('Transición no permitida en el flujo público')
        }
        const idCargo = d.idCargo
        const urlPago = d.urlPago
        return conTransaccionDb(async (tx) => {
          const filas = await tx.execute<{ registrado: boolean }>(sql`
            SELECT public.registrar_cargo_donacion_publica(
              ${d.id}::uuid, ${idCargo}, ${urlPago}, ${d.actualizadaEn.toISOString()}::timestamptz
            ) AS registrado`)
          return Boolean(filas[0]?.registrado)
        })
      }

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
      // Lectura completa: solo sistema (conciliación) o panel. El flujo público usa buscarResumenPublico.
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.referencia, referencia)), { modo: 'sistema' })
    },

    async buscarPorIdCargo(idCargo) {
      return conTransaccionDb((tx) => buscarUnica(tx, eq(donaciones.idCargo, idCargo)), { modo: 'sistema' })
    },

    async buscarIntentoPorClave(clave) {
      if (!esUuidValido(clave)) return null
      return conTransaccionDb(
        async (tx) => {
          const [fila] = await tx.execute<{ referencia: string; estado: string; url_pago: string | null }>(
            sql`SELECT referencia, estado, url_pago FROM public.intento_donacion_por_clave(${clave}::uuid)`,
          )
          if (!fila) return null
          return { referencia: fila.referencia, estado: EstadoDonacion.parse(fila.estado), urlPago: fila.url_pago }
        },
        { modo: 'publico' },
      )
    },

    async buscarResumenPublico(referencia) {
      if (!ReferenciaDonacion.safeParse(referencia).success) return null
      return conTransaccionDb(
        async (tx) => {
          const [fila] = await tx.execute<{
            referencia: string
            estado: string
            importe_centavos: string | number | bigint
            moneda: string
            creada_en: string | Date
            quiere_certificado: boolean
          }>(sql`
            SELECT referencia, estado, importe_centavos::text AS importe_centavos, moneda, creada_en, quiere_certificado
              FROM public.resultado_donacion_publica(${referencia})`)
          if (!fila) return null
          return {
            referencia: fila.referencia,
            estado: EstadoDonacion.parse(fila.estado),
            importe: { centavos: BigInt(fila.importe_centavos), moneda: Moneda.parse(fila.moneda.trim()) },
            creadaEn: new Date(fila.creada_en),
            quiereCertificado: Boolean(fila.quiere_certificado),
          }
        },
        { modo: 'publico' },
      )
    },

    async reservarConsultaPasarela(referencia, intervaloSegundos) {
      if (!ReferenciaDonacion.safeParse(referencia).success) return false
      const intervalo = Math.trunc(intervaloSegundos)
      return conTransaccionDb(
        async (tx) => {
          const [fila] = await tx.execute<{ reservada: boolean }>(
            sql`SELECT public.reservar_consulta_pasarela_publica(${referencia}, ${intervalo}::integer) AS reservada`,
          )
          return Boolean(fila?.reservada)
        },
        { modo: 'publico' },
      )
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
