/**
 * Nombres de las cookies de autenticación. Sin `server-only` porque también
 * los lee src/proxy.ts. En HTTPS llevan el prefijo `__Host-` (obliga a
 * Secure, Path=/ y sin Domain: no se pueden inyectar desde un subdominio).
 */
export function nombresCookies(esHttps: boolean) {
  const prefijo = esHttps ? '__Host-' : ''
  return {
    sesion: `${prefijo}proinserco_sesion`,
    desafioMfa: `${prefijo}proinserco_mfa`,
  } as const
}

/** Todas las variantes, para que el proxy compruebe la presencia sin leer el entorno. */
export const NOMBRES_COOKIE_SESION = [nombresCookies(true).sesion, nombresCookies(false).sesion] as const
