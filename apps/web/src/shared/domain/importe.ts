import { z } from 'zod'

/**
 * Dinero: entero en la unidad mínima (centavos) + moneda. Nunca `number`.
 * COP no usa centavos en la práctica, pero se guardan para no depender de
 * eso: 10.000 COP = 1_000_000n centavos.
 */
export const Moneda = z.enum(['COP'])
export type Moneda = z.infer<typeof Moneda>

export type Importe = Readonly<{ centavos: bigint; moneda: Moneda }>

export const CENTAVOS_POR_PESO = 100n

export function importeDesdePesos(pesos: number, moneda: Moneda = 'COP'): Importe {
  if (!Number.isSafeInteger(pesos) || pesos < 0) throw new RangeError('Pesos debe ser un entero no negativo')
  return { centavos: BigInt(pesos) * CENTAVOS_POR_PESO, moneda }
}

/** Para mostrar. Trunca: los importes de donación son en pesos enteros. */
export function pesosDeImporte(importe: Importe): number {
  return Number(importe.centavos / CENTAVOS_POR_PESO)
}

export function importesIguales(a: Importe, b: Importe): boolean {
  return a.centavos === b.centavos && a.moneda === b.moneda
}

export function sumarImportes(importes: readonly Importe[], moneda: Moneda = 'COP'): Importe {
  return { centavos: importes.reduce((acc, i) => acc + i.centavos, 0n), moneda }
}
