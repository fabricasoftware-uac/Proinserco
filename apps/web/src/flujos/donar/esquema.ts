import '@/shared/lib/zod-sin-eval'
import { z } from 'zod'
import { DonacionEntrada } from '@/modules/donaciones'
import { AutorizacionDatos, DatosDonante } from '@/modules/donantes'

/**
 * Flujo "Donar": cruza dos módulos (donaciones + donantes), por eso vive
 * fuera de ambos y solo usa sus barrels públicos.
 *
 * ESTE es el esquema del formulario de donación: lo usa el cliente con
 * `zodResolver` y la server action en el servidor. Mismo esquema, dos bordes.
 */
export const FormularioDonacion = z.strictObject({
  ...DonacionEntrada.shape,
  donante: DatosDonante,
  /** Casilla NO premarcada; `literal(true)` hace que sin ella no se procese nada. */
  autorizacionDatos: AutorizacionDatos,
  quiereCertificado: z.boolean().default(false),
  /** Token del widget de Turnstile (paso 3). Lo verifica el middleware conAntiBots. */
  tokenAntiBots: z.string().min(1).max(2048),
  /** Honeypot: campo oculto que un humano deja vacío. Si llega con valor, se descarta en silencio. */
  sitioWeb: z.string().max(200).optional(),
})
export type FormularioDonacion = z.infer<typeof FormularioDonacion>
export type FormularioDonacionEntrada = z.input<typeof FormularioDonacion>
