/**
 * Generador pseudoaleatorio determinista (mulberry32) para datos semilla de
 * DEMOSTRACIÓN. Misma semilla = mismos datos en cada arranque y en los tests.
 * NUNCA para nada relacionado con seguridad (ids, tokens, referencias).
 */
export function crearAleatorioDeterminista(semilla: number) {
  let estado = semilla >>> 0
  function siguiente(): number {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    siguiente,
    entero(min: number, max: number): number {
      return Math.floor(siguiente() * (max - min + 1)) + min
    },
    elegir<T>(opciones: readonly T[]): T {
      const elegido = opciones[Math.floor(siguiente() * opciones.length)]
      if (elegido === undefined) throw new RangeError('Lista vacía')
      return elegido
    },
    digitos(n: number): string {
      return Array.from({ length: n }, () => Math.floor(siguiente() * 10)).join('')
    },
  }
}
export type AleatorioDeterminista = ReturnType<typeof crearAleatorioDeterminista>
