import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import type { Reloj } from '@/shared/application/ports/reloj'
import { EventoAuditable } from '@/shared/domain/evento-auditable'
import type { RegistroAuditoria } from '../ports/registro-auditoria'

type Dependencias = { registro: RegistroAuditoria; reloj: Reloj; ids: GeneradorIds }

/** Valida el evento (topes de longitud, sin campos extra) y lo inserta. */
export function crearRegistrarAuditoria(deps: Dependencias) {
  return async function registrarAuditoria(evento: unknown): Promise<void> {
    const valido = EventoAuditable.parse(evento)
    await deps.registro.insertar({ ...valido, id: deps.ids.uuid(), ocurridoEn: deps.reloj.ahora() })
  }
}
