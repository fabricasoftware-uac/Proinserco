import { z } from 'zod'
import { type Importe, importeDesdePesos } from '@/shared/domain/importe'
import { MontoFueraDeRango } from './errores'

/** Límites configurables (env). Un monto ridículo (1 peso) es señal de card testing. */
export type LimitesMonto = Readonly<{ minimoPesos: number; maximoPesos: number }>

/** Forma: entero positivo en pesos. El rango se valida aparte, con los límites vigentes. */
export const MontoPesos = z.coerce.number().int().positive().max(1_000_000_000)

/**
 * El servidor decide el importe: valida el monto pedido contra el rango y lo
 * convierte a centavos. Nunca se usa un importe calculado en el navegador.
 */
export function importeDeDonacion(montoPesos: number, limites: LimitesMonto): Importe {
  if (!Number.isSafeInteger(montoPesos) || montoPesos < limites.minimoPesos || montoPesos > limites.maximoPesos) {
    throw new MontoFueraDeRango(limites.minimoPesos, limites.maximoPesos)
  }
  return importeDesdePesos(montoPesos)
}
