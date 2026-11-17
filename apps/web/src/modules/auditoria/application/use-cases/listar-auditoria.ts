import type { Actor } from '@/shared/domain/actor'
import { type Pagina, Paginacion } from '@/shared/domain/paginacion'
import { type EntradaAuditoria, FiltrosAuditoria } from '../../domain/entrada-auditoria'
import type { RegistroAuditoria } from '../ports/registro-auditoria'

type Dependencias = { registro: RegistroAuditoria }

export function crearListarAuditoria(deps: Dependencias) {
  return async function listarAuditoria(filtros: unknown, paginacion: unknown, actor: Actor): Promise<Pagina<EntradaAuditoria>> {
    actor.exigir('auditoria:leer')
    return deps.registro.listar(FiltrosAuditoria.parse(filtros ?? {}), Paginacion.parse(paginacion ?? {}))
  }
}
