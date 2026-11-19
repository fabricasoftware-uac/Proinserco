/**
 * Acción que declara el widget de Turnstile del formulario de donar. El servidor exige
 * que siteverify devuelva exactamente esta acción: un token emitido para otro formulario
 * u otro sitio con la misma clave no sirve aquí.
 */
export const ACCION_TURNSTILE_DONAR = 'donar'

/**
 * Claves de PRUEBA de Cloudflare Turnstile (de sitio y secretas) empiezan por 1x0000, 2x0000
 * o 3x0000: siempre pasan, siempre fallan o fuerzan el reto. Prohibidas en producción.
 */
export function esClaveDePruebaTurnstile(clave: string | undefined): boolean {
  return /^[123]x0000/.test(clave?.trim() ?? '')
}
