import { randomBytes, randomUUID } from 'node:crypto'
import type { GeneradorIds } from '../application/ports/generador-ids'

/** Crockford base32: sin I, L, O, U para que se pueda dictar por teléfono. */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 21 símbolos × 5 bits = 105 bits de entropía: no se puede enumerar. */
function referenciaAleatoria(): string {
  const bytes = randomBytes(21)
  let salida = ''
  for (const b of bytes) salida += ALFABETO[b & 31]
  return `DON-${salida}`
}

export function crearGeneradorIdsCripto(): GeneradorIds {
  return { uuid: () => randomUUID(), referencia: referenciaAleatoria }
}
