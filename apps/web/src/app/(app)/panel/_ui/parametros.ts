import { z } from 'zod'
import { EstadoDonacion, LineaApoyo } from '@/modules/donaciones'
import { AccionAuditable } from '@/shared/domain/evento-auditable'

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Cursor = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/)
const Pila = z
  .string()
  .max(1200)
  .regex(/^[A-Za-z0-9_,-]+$/)
const Texto = z.string().trim().min(2).max(100)
const Pesos = z.coerce.number().int().min(0).max(1_000_000_000_000)

/**
 * Parámetros de la URL de /panel/donaciones. Todo se valida aquí con Zod: un valor raro
 * se descarta (no rompe la página) y nada llega al caso de uso sin pasar por este esquema.
 */
export const ParametrosDonaciones = z.object({
  q: Texto.optional().catch(undefined),
  estado: EstadoDonacion.optional().catch(undefined),
  linea: LineaApoyo.optional().catch(undefined),
  desde: Fecha.optional().catch(undefined),
  hasta: Fecha.optional().catch(undefined),
  min: Pesos.optional().catch(undefined),
  max: Pesos.optional().catch(undefined),
  orden: z.enum(['fecha', 'monto', 'estado']).catch('fecha'),
  dir: z.enum(['asc', 'desc']).catch('desc'),
  /** Paginación nativa: cursor actual y pila de cursores anteriores (para "Anterior"). */
  cursor: Cursor.optional().catch(undefined),
  pila: Pila.optional().catch(undefined),
  /** Solo en modo acotado. */
  pagina: z.coerce.number().int().min(1).max(100).catch(1),
})
export type ParametrosDonaciones = z.infer<typeof ParametrosDonaciones>

export const ParametrosDonantes = z.object({
  q: Texto.optional().catch(undefined),
  cursor: Cursor.optional().catch(undefined),
  pila: Pila.optional().catch(undefined),
})
export type ParametrosDonantes = z.infer<typeof ParametrosDonantes>

export const ParametrosAuditoria = z.object({
  accion: AccionAuditable.optional().catch(undefined),
  actor: z.string().trim().min(1).max(80).optional().catch(undefined),
  desde: Fecha.optional().catch(undefined),
  hasta: Fecha.optional().catch(undefined),
  cursor: Cursor.optional().catch(undefined),
  pila: Pila.optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(100).catch(1),
})
export type ParametrosAuditoria = z.infer<typeof ParametrosAuditoria>

/** Id de la URL: acotado y sin caracteres raros antes de tocar el repositorio. */
export const IdRecurso = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/)

export const LIMITE_PAGINA = 20

/** Pila de cursores: "a,b,c" → ['a','b','c'] (máximo 30). */
export const leerPila = (pila: string | undefined): string[] => (pila ? pila.split(',').filter(Boolean).slice(-30) : [])
