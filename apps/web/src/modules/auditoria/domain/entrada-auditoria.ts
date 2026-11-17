import { z } from 'zod'
import { AccionAuditable, type EventoAuditable } from '@/shared/domain/evento-auditable'

/** Una fila de la auditoría: el evento + cuándo y su id. Inmutable, solo inserción. */
export type EntradaAuditoria = Readonly<EventoAuditable & { id: string; ocurridoEn: Date }>

export const FiltrosAuditoria = z.object({
  accion: AccionAuditable.optional().catch(undefined),
  actorId: z.string().max(80).optional().catch(undefined),
  recurso: z.string().max(60).optional().catch(undefined),
  recursoId: z.string().max(120).optional().catch(undefined),
})
export type FiltrosAuditoria = z.infer<typeof FiltrosAuditoria>
