import type { LimitadorDeTasa } from '../application/ports/limitador-de-tasa'
import type { Reloj } from '../application/ports/reloj'

/**
 * Ventana fija en memoria del proceso. Válido para desarrollo y para UNA
 * sola instancia (un contenedor en Coolify). Con varias instancias, usar
 * el adaptador Redis (limitador-redis.ts).
 */
export function crearLimitadorMemoria(reloj: Reloj, maxClaves = 50_000): LimitadorDeTasa {
  const ventanas = new Map<string, { inicio: number; cuenta: number; ventanaMs: number }>()

  function purgar(ahora: number) {
    if (ventanas.size < maxClaves) return
    for (const [clave, v] of ventanas) if (ahora - v.inicio >= v.ventanaMs) ventanas.delete(clave)
    // Si sigue lleno tras purgar, se descartan las más antiguas: mejor
    // olvidar un contador viejo que crecer sin límite (vector de DoS).
    while (ventanas.size >= maxClaves) {
      const primera = ventanas.keys().next().value
      if (primera === undefined) break
      ventanas.delete(primera)
    }
  }

  return {
    async consumir(clave, limite, ventanaSegundos) {
      const ahora = reloj.ahora().getTime()
      const ventanaMs = ventanaSegundos * 1000
      purgar(ahora)
      const actual = ventanas.get(clave)
      const vigente = actual && ahora - actual.inicio < ventanaMs ? actual : { inicio: ahora, cuenta: 0, ventanaMs }
      vigente.cuenta += 1
      ventanas.set(clave, vigente)
      const permitido = vigente.cuenta <= limite
      return {
        permitido,
        restantes: Math.max(0, limite - vigente.cuenta),
        reintentarEnSegundos: permitido ? 0 : Math.ceil((vigente.inicio + ventanaMs - ahora) / 1000),
      }
    },
  }
}
