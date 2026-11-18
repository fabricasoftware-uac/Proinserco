import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { escaparParaLike, esUuidValido, normalizarLimitePaginacion, parsearFechaCursor } from '@/server/db/consultas'
import { conTransaccionDb, normalizarIpParaInet } from '@/server/db/contexto-db'
import { consentimientos, donantes, type FilaConsentimiento, type FilaDonante } from '@/server/db/schema'
import { codificarCursor, decodificarCursor } from '@/shared/domain/paginacion'
import type { RegistroConsentimientos } from '../application/ports/registro-consentimientos'
import type { RepositorioDonantes } from '../application/ports/repositorio-donantes'
import type { Consentimiento } from '../domain/consentimiento'
import type { Donante, DonanteId } from '../domain/donante'

function aDonante(fila: FilaDonante): Donante {
  return Object.freeze({
    id: fila.id as DonanteId,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    tipoDocumento: fila.tipoDocumento,
    numeroDocumento: fila.numeroDocumento,
    correo: fila.correo,
    celular: fila.celular,
    quiereCertificado: fila.quiereCertificado,
    creadoEn: fila.creadoEn,
    actualizadoEn: fila.actualizadoEn,
  })
}

function aConsentimiento(fila: FilaConsentimiento): Consentimiento {
  return Object.freeze({
    id: fila.id,
    donanteId: fila.donanteId,
    correo: fila.correo,
    finalidad: fila.finalidad,
    versionTexto: fila.versionTexto,
    otorgada: fila.otorgada,
    ip: fila.ip,
    userAgent: fila.userAgent,
    creadoEn: fila.creadoEn,
  })
}

/**
 * Repositorio PostgreSQL de donantes sobre `public.donantes`.
 * Las lecturas administrativas (`buscarPorId`, `listar`, `contar`) exigen contexto
 * activo o actor del panel; los flujos de registro público usan respaldo `publico`.
 */
export function crearRepositorioDonantesPostgres(): RepositorioDonantes {
  return {
    async guardar(donante) {
      if (!esUuidValido(donante.id)) {
        throw new Error('Identificador de donante inválido: se requiere un UUID')
      }

      await conTransaccionDb(
        async (tx) => {
          await tx
            .insert(donantes)
            .values({
              id: donante.id,
              nombres: donante.nombres,
              apellidos: donante.apellidos,
              tipoDocumento: donante.tipoDocumento,
              numeroDocumento: donante.numeroDocumento,
              correo: donante.correo,
              celular: donante.celular,
              quiereCertificado: donante.quiereCertificado,
              creadoEn: donante.creadoEn,
              actualizadoEn: donante.actualizadoEn,
            })
            .onConflictDoUpdate({
              target: donantes.id,
              set: {
                nombres: donante.nombres,
                apellidos: donante.apellidos,
                tipoDocumento: donante.tipoDocumento,
                numeroDocumento: donante.numeroDocumento,
                correo: donante.correo,
                celular: donante.celular,
                quiereCertificado: donante.quiereCertificado,
                actualizadoEn: donante.actualizadoEn,
              },
            })
        },
        { modo: 'publico' },
      )
    },

    async buscarPorId(id) {
      if (!esUuidValido(id)) return null

      return conTransaccionDb(async (tx) => {
        const [fila] = await tx.select().from(donantes).where(eq(donantes.id, id)).limit(1)
        return fila ? aDonante(fila) : null
      })
    },

    async buscarPorDocumento(tipo, numero) {
      return conTransaccionDb(
        async (tx) => {
          const [fila] = await tx
            .select()
            .from(donantes)
            .where(and(eq(donantes.tipoDocumento, tipo), eq(donantes.numeroDocumento, numero)))
            .limit(1)
          return fila ? aDonante(fila) : null
        },
        { modo: 'publico' },
      )
    },

    async listar(filtros, paginacion) {
      const limite = normalizarLimitePaginacion(paginacion.limite)
      const texto = filtros.q?.trim()
      const patron = texto ? `%${escaparParaLike(texto)}%` : null
      const whereFiltros = patron
        ? sql`(${donantes.nombres} || ' ' || ${donantes.apellidos} || ' ' || ${donantes.correo}) ILIKE ${patron}`
        : undefined

      const decodificado = decodificarCursor(paginacion.cursor)
      const fechaCursor =
        decodificado && !decodificado.o && esUuidValido(decodificado.id) ? parsearFechaCursor(decodificado.en) : null

      const condicionCursor =
        fechaCursor && decodificado
          ? sql`(${donantes.creadoEn}, ${donantes.id}) < (${sql.param(fechaCursor, donantes.creadoEn)}, ${sql.param(decodificado.id, donantes.id)})`
          : undefined

      const wherePagina = condicionCursor ? (whereFiltros ? and(whereFiltros, condicionCursor) : condicionCursor) : whereFiltros

      return conTransaccionDb(async (tx) => {
        const [conteo] = await tx.select({ total: count() }).from(donantes).where(whereFiltros)
        const filas = await tx
          .select()
          .from(donantes)
          .where(wherePagina)
          .orderBy(desc(donantes.creadoEn), desc(donantes.id))
          .limit(limite + 1)

        const hayMas = filas.length > limite
        const visibles = hayMas ? filas.slice(0, limite) : filas
        const ultimo = visibles.at(-1)

        return {
          elementos: visibles.map(aDonante),
          cursorSiguiente: hayMas && ultimo ? codificarCursor({ en: ultimo.creadoEn.toISOString(), id: ultimo.id }) : null,
          total: Number(conteo?.total ?? 0),
        }
      })
    },

    async contar() {
      return conTransaccionDb(async (tx) => {
        const [conteo] = await tx.select({ total: count() }).from(donantes)
        return Number(conteo?.total ?? 0)
      })
    },
  }
}

/**
 * Registro de consentimientos Ley 1581 de solo inserción (`public.consentimientos`).
 */
export function crearRegistroConsentimientosPostgres(): RegistroConsentimientos {
  return {
    async insertar(consentimiento) {
      if (!esUuidValido(consentimiento.id) || !esUuidValido(consentimiento.donanteId)) {
        throw new Error('Identificadores de consentimiento inválidos: se requieren UUIDs')
      }

      await conTransaccionDb(
        async (tx) => {
          await tx.insert(consentimientos).values({
            id: consentimiento.id,
            donanteId: consentimiento.donanteId,
            correo: consentimiento.correo,
            finalidad: consentimiento.finalidad,
            versionTexto: consentimiento.versionTexto,
            otorgada: consentimiento.otorgada,
            ip: normalizarIpParaInet(consentimiento.ip),
            userAgent: consentimiento.userAgent,
            creadoEn: consentimiento.creadoEn,
          })
        },
        { modo: 'publico' },
      )
    },

    async listarPorDonante(donanteId) {
      if (!esUuidValido(donanteId)) return []

      return conTransaccionDb(async (tx) => {
        const filas = await tx
          .select()
          .from(consentimientos)
          .where(eq(consentimientos.donanteId, donanteId))
          .orderBy(asc(consentimientos.creadoEn), asc(consentimientos.id))
        return filas.map(aConsentimiento)
      })
    },
  }
}
