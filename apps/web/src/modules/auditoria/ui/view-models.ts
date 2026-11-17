import type { Pagina } from '@/shared/domain/paginacion'
import type { EntradaAuditoria } from '../domain/entrada-auditoria'

export type EntradaAuditoriaVM = Readonly<{
  id: string
  ocurridoEn: string
  accion: string
  actorId: string
  recurso: string
  recursoId: string | null
  ip: string | null
  detalles: Readonly<Record<string, string | number | boolean | null>>
}>

export function aEntradaAuditoria(e: EntradaAuditoria): EntradaAuditoriaVM {
  return { ...e, ocurridoEn: e.ocurridoEn.toISOString() }
}

export function aPaginaAuditoria(p: Pagina<EntradaAuditoria>) {
  return { elementos: p.elementos.map(aEntradaAuditoria), cursorSiguiente: p.cursorSiguiente, total: p.total }
}
