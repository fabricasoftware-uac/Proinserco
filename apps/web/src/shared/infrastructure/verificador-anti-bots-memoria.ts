import type { VerificadorAntiBots } from '../application/ports/verificador-anti-bots'

/** Token que el adaptador en memoria rechaza siempre: sirve para probar el camino de error. */
export const TOKEN_ANTIBOTS_RECHAZADO = 'rechazar-antibots'

/**
 * Verificador de demostración: acepta cualquier token no vacío salvo
 * TOKEN_ANTIBOTS_RECHAZADO. Con el widget de Turnstile en modo prueba
 * (site key 1x00000000000000000000AA) el token llega igual que en producción.
 */
export function crearVerificadorAntiBotsMemoria(): VerificadorAntiBots {
  return {
    async verificar(token) {
      return token.length > 0 && token.length <= 2048 && token !== TOKEN_ANTIBOTS_RECHAZADO
    },
  }
}
