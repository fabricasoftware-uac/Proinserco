import { and, count, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm'
import { esUuidValido, normalizarLimitePaginacion, parsearFechaCursor } from '@/server/db/consultas'
import { conTransaccionDb, normalizarIpParaInet } from '@/server/db/contexto-db'
import { auditoria, type FilaAuditoria } from '@/server/db/schema'
import { type AccionAuditable, EventoAuditable } from '@/shared/domain/evento-auditable'
import { codificarCursor, decodificarCursor } from '@/shared/domain/paginacion'
import type { RegistroAuditoria } from '../application/ports/registro-auditoria'
import type { EntradaAuditoria } from '../domain/entrada-auditoria'

const ACCIONES_CON_RESPALDO_SISTEMA: ReadonlySet<AccionAuditable> = new Set([
  'sesion.iniciada',
  'sesion.fallida',
  'sesion.mfa_fallido',
  'sesion.cerrada',
  'donacion.transicion',
  'donacion.discrepancia',
  'donacion.creada',
  'consentimiento.registrado',
  'conciliacion.alerta',
])

function aEntradaAuditoria(fila: FilaAuditoria): EntradaAuditoria {
  return Object.freeze({
    id: fila.id,
    ocurridoEn: fila.ocurridoEn,
    accion: fila.accion,
    actorId: fila.actorId,
    recurso: fila.recurso,
    recursoId: fila.recursoId,
    ip: fila.ip,
    detalles: Object.freeze({ ...fila.detalles }),
  })
}

/**
 * Adaptador PostgreSQL de solo inserción para la tabla `public.auditoria`.
 * Respeta RLS y normaliza IPs inválidas o `'desconocida'` a `NULL` para `inet`.
 */
export function crearRegistroAuditoriaPostgres(): RegistroAuditoria {
  return {
    async insertar(entrada) {
      const evento = EventoAuditable.parse(entrada)
      if (!esUuidValido(entrada.id)) {
        throw new Error('Identificador de auditoría inválido: se requiere un UUID')
      }

      const contextoRespaldo = ACCIONES_CON_RESPALDO_SISTEMA.has(evento.accion) ? ({ modo: 'sistema' } as const) : undefined

      await conTransaccionDb(async (tx) => {
        await tx.insert(auditoria).values({
          id: entrada.id,
          ocurridoEn: entrada.ocurridoEn,
          accion: evento.accion,
          actorId: evento.actorId,
          recurso: evento.recurso,
          recursoId: evento.recursoId,
          ip: normalizarIpParaInet(evento.ip),
          detalles: evento.detalles,
        })
      }, contextoRespaldo)
    },

    async listar(filtros, paginacion) {
      const limite = normalizarLimitePaginacion(paginacion.limite)
      const condiciones: SQL[] = []
      if (filtros.accion) condiciones.push(eq(auditoria.accion, filtros.accion))
      if (filtros.actorId) condiciones.push(eq(auditoria.actorId, filtros.actorId))
      if (filtros.recurso) condiciones.push(eq(auditoria.recurso, filtros.recurso))
      if (filtros.recursoId) condiciones.push(eq(auditoria.recursoId, filtros.recursoId))
      if (filtros.desde) condiciones.push(gte(auditoria.ocurridoEn, filtros.desde))
      if (filtros.hasta) condiciones.push(lte(auditoria.ocurridoEn, filtros.hasta))

      const decodificado = decodificarCursor(paginacion.cursor)
      const fechaCursor =
        decodificado && !decodificado.o && esUuidValido(decodificado.id) ? parsearFechaCursor(decodificado.en) : null

      const condicionCursor =
        fechaCursor && decodificado
          ? sql`(${auditoria.ocurridoEn}, ${auditoria.id}) < (${sql.param(fechaCursor, auditoria.ocurridoEn)}, ${sql.param(decodificado.id, auditoria.id)})`
          : undefined

      const whereFiltros = condiciones.length > 0 ? and(...condiciones) : undefined
      const wherePagina = condicionCursor ? (whereFiltros ? and(whereFiltros, condicionCursor) : condicionCursor) : whereFiltros

      return conTransaccionDb(async (tx) => {
        const [conteo] = await tx.select({ total: count() }).from(auditoria).where(whereFiltros)
        const filas = await tx
          .select()
          .from(auditoria)
          .where(wherePagina)
          .orderBy(desc(auditoria.ocurridoEn), desc(auditoria.id))
          .limit(limite + 1)

        const hayMas = filas.length > limite
        const visibles = hayMas ? filas.slice(0, limite) : filas
        const ultimo = visibles.at(-1)

        return {
          elementos: visibles.map(aEntradaAuditoria),
          cursorSiguiente: hayMas && ultimo ? codificarCursor({ en: ultimo.ocurridoEn.toISOString(), id: ultimo.id }) : null,
          total: Number(conteo?.total ?? 0),
        }
      })
    },
  }
}
