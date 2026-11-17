import localFont from 'next/font/local'
import { fuentesSitio as fuentesBase } from '@/shared/ui/fuentes'

/**
 * Fuentes con carácter del sitio público, AUTOALOJADAS (licencia SIL OFL 1.1:
 * ver ../fuentes/OFL-anybody.txt y OFL-instrument-serif.txt). Origen:
 * @fontsource-variable/anybody 5.3.0 y @fontsource/instrument-serif 5.3.0
 * (archivos copiados, no son dependencia). Subconjunto latino (tildes y ñ).
 *
 * - Anybody: display variable con ejes wght 100–900 y wdth 50–150 %. Los
 *   titulares gigantes la usan condensada y negra (.mega); el ancho cambia
 *   dentro de una misma frase para dar contraste de escala.
 * - Instrument Serif itálica: la palabra pequeña y cálida entre palabras
 *   enormes ("al servicio *de la* comunidad").
 */
export const anybody = localFont({
  src: '../fuentes/anybody-variable.woff2',
  variable: '--fuente-anybody',
  display: 'swap',
  declarations: [
    { prop: 'font-weight', value: '100 900' },
    { prop: 'font-stretch', value: '50% 150%' },
  ],
  fallback: ['Arial Narrow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: false,
})

export const serifItalica = localFont({
  src: [{ path: '../fuentes/instrument-serif-italic.woff2', style: 'italic', weight: '400' }],
  variable: '--fuente-serif-italica',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: 'Times New Roman',
})

/** Clases que declaran las variables de las cuatro familias del sitio público. */
export const fuentesSitioPublico = `${fuentesBase} ${anybody.variable} ${serifItalica.variable}`
