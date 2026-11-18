import { paginarDescendente } from '@/shared/domain/paginacion'
import type { RegistroAuditoria } from '../application/ports/registro-auditoria'
import type { EntradaAuditoria } from '../domain/entrada-auditoria'

/** Auditoría EN MEMORIA (demo y tests). Solo añade; con tope para no crecer sin límite. */
export function crearRegistroAuditoriaMemoria(maximo = 10_000): RegistroAuditoria {
  const filas: EntradaAuditoria[] = []
  return {
    async insertar(entrada) {
      filas.push(Object.freeze({ ...entrada, detalles: Object.freeze({ ...entrada.detalles }) }))
      if (filas.length > maximo) filas.shift()
    },
    async listar(filtros, paginacion) {
      const lista = filas
        .filter(
          (e) =>
            (!filtros.accion || e.accion === filtros.accion) &&
            (!filtros.actorId || e.actorId === filtros.actorId) &&
            (!filtros.recurso || e.recurso === filtros.recurso) &&
            (!filtros.recursoId || e.recursoId === filtros.recursoId) &&
            (!filtros.desde || e.ocurridoEn >= filtros.desde) &&
            (!filtros.hasta || e.ocurridoEn <= filtros.hasta),
        )
        .sort((a, b) => b.ocurridoEn.getTime() - a.ocurridoEn.getTime() || (b.id < a.id ? -1 : 1))
      return paginarDescendente(lista, (e) => ({ en: e.ocurridoEn.toISOString(), id: e.id }), paginacion)
    },
  }
}
