/** Enlaces de sección de la página principal (menú y footer). */
export const ENLACES_SECCION = [
  { id: 'quienes-somos', etiqueta: 'Quiénes somos' },
  { id: 'que-hacemos', etiqueta: 'Qué hacemos' },
  { id: 'capacitaciones', etiqueta: 'Capacitaciones' },
  { id: 'territorio', etiqueta: 'Territorio' },
  { id: 'equipo', etiqueta: 'Equipo' },
  { id: 'contacto', etiqueta: 'Contacto' },
] as const

export type IdSeccion = (typeof ENLACES_SECCION)[number]['id']

/** Foto que asoma al pasar el ratón por un enlace del menú. */
export type PreviaMenu = { id: IdSeccion; src: string }

export const ENLACES_LEGALES = [
  { href: '/legal/tratamiento-de-datos', etiqueta: 'Tratamiento de datos' },
  { href: '/legal/aviso-de-privacidad', etiqueta: 'Aviso de privacidad' },
  { href: '/legal/cookies', etiqueta: 'Política de cookies' },
  { href: '/legal/terminos', etiqueta: 'Términos y condiciones' },
  { href: '/legal/donaciones', etiqueta: 'Política de donaciones' },
] as const

/** Formato de pesos colombianos sin decimales: 50000 → "$50.000". */
export function formatoPesos(valor: number) {
  return `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}
