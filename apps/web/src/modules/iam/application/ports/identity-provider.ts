import type { Credenciales } from '../../domain/esquemas'
import type { Identidad } from '../../domain/identidad'
import type { AlmacenCookies } from './almacen-cookies'

/** Datos de la petición que el proveedor necesita (bloqueo progresivo por correo + IP). */
export type ContextoInicioSesion = Readonly<{ ip: string | null }>

/**
 * Proveedor de identidad. Hoy: adaptador en memoria (demo). Mañana: Supabase
 * Auth con MFA TOTP. Los casos de uso no saben cuál hay detrás.
 */
export interface IdentityProvider {
  /**
   * Primer factor. Si es correcto deja un desafío MFA pendiente y devuelve el usuario.
   * Si no, lanza CredencialesInvalidas (mismo error exista o no el correo).
   * Una cuenta SIN factor TOTP verificado NO puede registrarlo desde aquí (quien robe
   * una contraseña registraría su propio TOTP): se cierra la sesión y se lanza
   * AccesoNoActivado. El TOTP se enrola en el alta (scripts/alta-usuario-panel.mjs).
   */
  iniciarSesion(
    credenciales: Credenciales,
    cookies: AlmacenCookies,
    contexto: ContextoInicioSesion,
  ): Promise<{ usuarioId: string }>
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
