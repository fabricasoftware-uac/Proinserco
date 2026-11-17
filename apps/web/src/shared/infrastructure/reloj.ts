import type { Reloj } from '../application/ports/reloj'

export function crearRelojSistema(): Reloj {
  return { ahora: () => new Date() }
}

/** Reloj controlable para tests. */
export function crearRelojFijo(inicial: Date): Reloj & { avanzar(ms: number): void; fijar(fecha: Date): void } {
  let actual = new Date(inicial)
  return {
    ahora: () => new Date(actual),
    avanzar: (ms) => {
      actual = new Date(actual.getTime() + ms)
    },
    fijar: (fecha) => {
      actual = new Date(fecha)
    },
  }
}
