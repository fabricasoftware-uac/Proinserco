import type { EventoAuditable } from '../../domain/evento-auditable'

/**
 * Escritura en la auditoría (solo inserción). Lo implementa el módulo
 * `auditoria`; el composition root lo conecta con los demás módulos.
 */
export interface Auditor {
  registrar(evento: EventoAuditable): Promise<void>
}
