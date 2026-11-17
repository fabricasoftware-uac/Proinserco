import type { Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { EntradaAuditoria, FiltrosAuditoria } from '../../domain/entrada-auditoria'

/** Auditoría de SOLO INSERCIÓN: no existe actualizar ni borrar, ni para administradores. */
export interface RegistroAuditoria {
  insertar(entrada: EntradaAuditoria): Promise<void>
  listar(filtros: FiltrosAuditoria, paginacion: Paginacion): Promise<Pagina<EntradaAuditoria>>
}
