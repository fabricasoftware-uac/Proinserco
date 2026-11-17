import { z } from 'zod'

/**
 * Lo que cualquier módulo puede pedir que quede en la auditoría.
 * NUNCA datos personales completos ni secretos: identificadores y metadatos.
 */
export const AccionAuditable = z.enum([
  'sesion.iniciada',
  'sesion.fallida',
  'sesion.mfa_fallido',
  'sesion.cerrada',
  'donacion.creada',
  'donacion.transicion',
  'donacion.discrepancia',
  'donacion.consultada',
  'donaciones.exportadas',
  'donante.registrado',
  'donante.dato_revelado',
  'donantes.exportados',
  'consentimiento.registrado',
  'ajustes.cambiados',
])
export type AccionAuditable = z.infer<typeof AccionAuditable>

export const EventoAuditable = z.object({
  accion: AccionAuditable,
  /** Id del usuario del panel o `sistema`. */
  actorId: z.string().max(80),
  recurso: z.string().max(60),
  recursoId: z.string().max(120).nullable(),
  /** IP del cliente si aplica (ya resuelta según el despliegue). */
  ip: z.string().max(64).nullable(),
  /** Metadatos sin datos personales: estados, conteos, filtros. */
  detalles: z.record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])),
})
export type EventoAuditable = z.infer<typeof EventoAuditable>
