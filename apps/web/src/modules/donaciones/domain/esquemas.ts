import { z } from 'zod'
import { EstadoDonacion } from './estado-donacion'
import { LineaApoyo } from './linea-apoyo'
import { MontoPesos } from './monto'

/**
 * Lo que el formulario público envía para crear una donación (sin los datos
 * del donante, que valida su propio módulo). El MISMO esquema se usa en el
 * cliente (zodResolver) y en la server action.
 */
export const DonacionEntrada = z.strictObject({
  montoPesos: MontoPesos,
  linea: LineaApoyo.default('donde-mas-se-necesite'),
  /** Generada por el formulario al montarse. Un doble envío no crea dos cargos. */
  claveIdempotencia: z.uuid(),
})
export type DonacionEntrada = z.infer<typeof DonacionEntrada>

/** Filtros del listado del panel. Lista blanca: nada llega a una consulta sin pasar por aquí. */
export const FiltrosDonaciones = z.object({
  estado: EstadoDonacion.optional(),
  linea: LineaApoyo.optional(),
  /** Busca por referencia o por correo del pagador. */
  q: z.string().trim().min(2).max(100).optional().catch(undefined),
  desde: z.coerce.date().optional().catch(undefined),
  hasta: z.coerce.date().optional().catch(undefined),
})
export type FiltrosDonaciones = z.infer<typeof FiltrosDonaciones>

/** Referencia pública de donación: `DON-` + 21 símbolos Crockford base32. */
export const ReferenciaDonacion = z.string().regex(/^DON-[0-9A-HJKMNP-TV-Z]{21}$/)
