import { NoImplementado } from '@/shared/domain/errores'
import type { RegistroAuditoria } from '../application/ports/registro-auditoria'

/**
 * ESQUELETO — Auditoría en Postgres.
 *
 * SALOMÓN:
 *  - Tabla `auditoria` (id, ocurrido_en, accion, actor_id, recurso, recurso_id, ip inet,
 *    detalles jsonb). RLS: INSERT para el rol de la app; SELECT solo para quien tenga
 *    `auditoria:leer`; NINGUNA política de UPDATE ni DELETE (y REVOKE explícito).
 *  - `detalles` nunca lleva datos personales completos ni secretos (ya lo garantiza
 *    el esquema EventoAuditable con topes de longitud; no relajarlo).
 *  - Paginación por cursor (ocurrido_en, id) e índice en (recurso, recurso_id).
 *  - Retención de IP en logs: definir plazo con el cliente (vault: Privacidad).
 */
export function crearRegistroAuditoriaPostgres(): RegistroAuditoria {
  return {
    async insertar() {
      throw new NoImplementado('RegistroAuditoria.insertar (Postgres)')
    },
    async listar() {
      throw new NoImplementado('RegistroAuditoria.listar (Postgres)')
    },
  }
}
