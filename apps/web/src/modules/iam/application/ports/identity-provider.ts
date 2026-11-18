import type { Credenciales } from '../../domain/esquemas'
import type { Identidad } from '../../domain/identidad'
import type { AlmacenCookies } from './almacen-cookies'

export type EnrolamientoMfaPendiente = Readonly<{
  factorId: string
  qrSvg: string
  secreto: string
  uri: string
}>

/**
 * Proveedor de identidad. Hoy: adaptador en memoria (demo). Mañana: Supabase
 * Auth con MFA TOTP. Los casos de uso no saben cuál hay detrás.
 */
export interface IdentityProvider {
  /**
   * Primer factor. Si es correcto deja un desafío MFA pendiente (cookie corta)
   * y devuelve el usuario (junto al QR/secreto si aún debe enrolar TOTP).
   * Si no, lanza CredencialesInvalidas (mismo error exista o no el correo).
   */
  iniciarSesion(
    credenciales: Credenciales,
    cookies: AlmacenCookies,
  ): Promise<{ usuarioId: string; enrolamientoMfa?: EnrolamientoMfaPendiente }>
  /** Usuario con un desafío MFA vigente, o null. Sirve para limitar intentos por usuario. */
  desafioPendiente(cookies: AlmacenCookies): Promise<string | null>
  /** Segundo factor (TOTP). Eleva la sesión a aal2. Un código no se puede reutilizar. */
  verificarSegundoFactor(codigo: string, cookies: AlmacenCookies): Promise<Identidad>
  /**
   * Identidad VALIDADA de la sesión (equivalente a `getUser()`, nunca a
   * `getSession()`): firma, caducidad y revocación comprobadas en servidor.
   */
  obtenerIdentidad(cookies: AlmacenCookies): Promise<Identidad | null>
  cerrarSesion(cookies: AlmacenCookies): Promise<void>
}
