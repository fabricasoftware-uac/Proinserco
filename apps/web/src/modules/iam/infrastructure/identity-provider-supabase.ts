import { NoImplementado } from '@/shared/domain/errores'
import type { IdentityProvider } from '../application/ports/identity-provider'

export type ConfiguracionSupabaseAuth = Readonly<{
  url: string
  /** Clave anónima. Aquí NO lleva NEXT_PUBLIC_: el navegador nunca habla con Supabase. */
  claveAnonima: string
}>

/**
 * ESQUELETO — IdentityProvider con Supabase Auth + MFA TOTP.
 * Referencia: vault `02 - Arquitectura/Autenticación y Autorización.md`.
 *
 * SALOMÓN:
 *  - Cliente con `@supabase/ssr` `createServerClient(url, claveAnonima, { cookies })`,
 *    donde `getAll`/`setAll` usan el `AlmacenCookies` recibido (cookies.todas() /
 *    cookies.establecer()). NUNCA la clave de servicio en el flujo de una petición.
 *  - iniciarSesion: `auth.signInWithPassword`. Ante cualquier error lanzar
 *    `CredencialesInvalidas` (mismo mensaje exista o no el correo). La sesión queda en
 *    aal1; `desafioPendiente` devuelve el user id mientras el nivel sea aal1 con un
 *    factor TOTP verificado disponible.
 *  - verificarSegundoFactor: `auth.mfa.challengeAndVerify({ factorId, code })` con el
 *    factor TOTP del usuario. Si no tiene factor: el panel debe obligar a darlo de
 *    alta (pantalla que no se puede saltar), no dejarlo pasar en aal1.
 *  - obtenerIdentidad: `auth.getUser()` (valida el JWT contra Supabase) — JAMÁS
 *    `getSession()`. Nivel con `auth.mfa.getAuthenticatorAssuranceLevel()`; el panel
 *    solo acepta `aal2`. El rol sale de `app_metadata` (Custom Access Token Hook que
 *    lee la tabla `usuario_roles`), NUNCA de `user_metadata`.
 *  - cerrarSesion: `auth.signOut()` (revoca el refresh token) y borrar cookies.
 *  - Configuración del proyecto: contraseña mínima 12, HIBP activado, JWT 3600 s,
 *    rotación y detección de reutilización de refresh tokens, rate limit de Auth,
 *    URLs de redirección exactas (sin comodines).
 *  - El proxy deberá además refrescar la sesión con `getUser()` y devolver la MISMA
 *    respuesta que acumuló las cookies (src/proxy.ts).
 */
export function crearIdentityProviderSupabase(_config: ConfiguracionSupabaseAuth): IdentityProvider {
  const pendiente = (metodo: string) => async (): Promise<never> => {
    throw new NoImplementado(`IdentityProvider.${metodo} (Supabase)`)
  }
  return {
    iniciarSesion: pendiente('iniciarSesion'),
    desafioPendiente: pendiente('desafioPendiente'),
    verificarSegundoFactor: pendiente('verificarSegundoFactor'),
    obtenerIdentidad: pendiente('obtenerIdentidad'),
    cerrarSesion: pendiente('cerrarSesion'),
  }
}
