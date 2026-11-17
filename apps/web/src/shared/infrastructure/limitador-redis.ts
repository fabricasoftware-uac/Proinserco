import type { LimitadorDeTasa } from '../application/ports/limitador-de-tasa'
import { NoImplementado } from '../domain/errores'

/**
 * ESQUELETO — Limitador de tasa con almacén compartido.
 *
 * SALOMÓN: implementar cuando la app corra en más de una instancia.
 *  - Almacén: Redis del VPS (Coolify) o Upstash. URL en LIMITADOR_URL (rediss:// con TLS).
 *  - Algoritmo: ventana fija o deslizante con INCR + EXPIRE atómicos (MULTI o script
 *    Lua). Nunca GET + SET por separado: dos peticiones simultáneas se cuelan.
 *  - Timeout corto (≤ 200 ms). Si Redis no responde: FALLAR CERRADO en login,
 *    MFA y crear donación (devolver permitido=false); no abrir la puerta porque
 *    el limitador esté caído.
 *  - Las claves llegan ya construidas (`login:ip:<ip>`); no meter datos
 *    personales en claro: hashear el correo antes de usarlo como clave.
 *  - Mientras no exista, el contenedor usa el limitador en memoria (válido
 *    con una sola instancia).
 */
export function crearLimitadorRedis(_url: string): LimitadorDeTasa {
  return {
    async consumir() {
      throw new NoImplementado('LimitadorDeTasa (Redis)')
    },
  }
}
