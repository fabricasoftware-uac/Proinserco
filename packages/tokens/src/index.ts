/**
 * Espejo en TypeScript de lo que JS necesita de los tokens (GSAP, Motion,
 * tipado de atributos). La fuente de verdad es el CSS; `tokens.test.ts`
 * comprueba que estos valores coinciden con primitivos.css.
 */

/** Temas de sección del sitio público: valor de `data-seccion-tema`. */
export const TEMAS_SECCION = ['crema', 'bosque', 'terracota', 'sol', 'lima', 'cielo'] as const
export type TemaSeccion = (typeof TEMAS_SECCION)[number]

/** Temas del panel: valor de `<html data-tema>`. `sistema` solo vive en el selector. */
export const TEMAS_PANEL = ['claro', 'oscuro'] as const
export type TemaPanel = (typeof TEMAS_PANEL)[number]
export type PreferenciaTema = TemaPanel | 'sistema'

/** Clave de localStorage donde se guarda la preferencia del panel. */
export const CLAVE_TEMA = 'tema'

/** Curvas de movimiento (CSS cubic-bezier). Para GSAP: CustomEase o `ease: 'power3.out'` equivalente. */
export const CURVAS = {
  salida: 'cubic-bezier(0.22, 1, 0.36, 1)',
  expoSalida: 'cubic-bezier(0.16, 1, 0.3, 1)',
  entradaSalida: 'cubic-bezier(0.65, 0, 0.35, 1)',
  entrada: 'cubic-bezier(0.55, 0, 1, 0.45)',
  reboteSuave: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

/** Duraciones en milisegundos. */
export const DURACIONES_MS = {
  instantanea: 100,
  rapida: 160,
  media: 280,
  lenta: 600,
  escena: 1200,
} as const
