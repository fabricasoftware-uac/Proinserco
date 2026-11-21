import { z } from 'zod'
import { type Importe, importeDesdePesos } from '@/shared/domain/importe'
import { MontoFueraDeRango } from './errores'

/** Límites configurables (env). Un monto ridículo (1 peso) es señal de card testing. */
export type LimitesMonto = Readonly<{ minimoPesos: number; maximoPesos?: number | undefined }>

/** Forma: entero positivo en pesos dentro del rango seguro al convertir a centavos. */
export const MontoPesos = z.coerce.number().int().positive().max(90_000_000_000_000)

/**
 * El servidor decide el importe: valida el monto pedido contra el rango y lo
 * convierte a centavos. Nunca se usa un importe calculado en el navegador.
 */
export function importeDeDonacion(montoPesos: number, limites: LimitesMonto): Importe {
  const superaMaximo = limites.maximoPesos !== undefined && montoPesos > limites.maximoPesos
  if (!Number.isSafeInteger(montoPesos) || montoPesos < limites.minimoPesos || superaMaximo) {
    throw new MontoFueraDeRango(limites.minimoPesos, limites.maximoPesos)
  }
  return importeDesdePesos(montoPesos)
}
