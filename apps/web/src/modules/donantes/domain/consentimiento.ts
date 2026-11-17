import { z } from 'zod'

/** Cada finalidad es una autorización separada (Ley 1581): nunca un "acepto todo". */
export const FinalidadConsentimiento = z.enum(['gestion_donacion', 'certificado_donacion', 'boletin'])
export type FinalidadConsentimiento = z.infer<typeof FinalidadConsentimiento>

/**
 * Prueba de la autorización: previa, expresa e informada. Solo inserción; una
 * revocación es una fila nueva con `otorgada: false`, nunca una edición.
 */
export type Consentimiento = Readonly<{
  id: string
  donanteId: string
  correo: string
  finalidad: FinalidadConsentimiento
  /** Versión exacta del texto legal mostrado. */
  versionTexto: string
  otorgada: boolean
  ip: string | null
  userAgent: string | null
  creadoEn: Date
}>

/** La casilla de autorización: no premarcada y obligatoria. `z.literal(true)` en servidor. */
export const AutorizacionDatos = z.literal(true, { error: 'Debes autorizar el tratamiento de tus datos para donar' })
