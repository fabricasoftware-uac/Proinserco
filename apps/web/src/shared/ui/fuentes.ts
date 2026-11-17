import localFont from 'next/font/local'

/**
 * Fuentes AUTOALOJADAS (el build no depende de Google). Subconjunto latino
 * (incluye tildes y ñ), variables. Licencia SIL OFL 1.1: ver fuentes/OFL-*.txt.
 * Origen: paquetes @fontsource-variable/* 5.3.0 (copiados, no son dependencia).
 *
 * Uso: el layout del sitio público aplica `fuentesSitio` en su raíz; luego
 * las utilidades `font-titular` y `font-cuerpo` (tokens) las leen.
 * Sin `weight` a propósito: con `weight` la fuente variable se vuelve estática.
 */
export const bricolage = localFont({
  src: './fuentes/bricolage-grotesque-variable.woff2',
  variable: '--fuente-bricolage',
  display: 'swap',
  // Ejes: wght 200–800 + opsz (tamaño óptico automático en titulares enormes).
  declarations: [{ prop: 'font-weight', value: '200 800' }],
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
})

export const instrumentSans = localFont({
  src: [
    { path: './fuentes/instrument-sans-variable.woff2', style: 'normal' },
    { path: './fuentes/instrument-sans-variable-italic.woff2', style: 'italic' },
  ],
  variable: '--fuente-instrument',
  display: 'swap',
  declarations: [{ prop: 'font-weight', value: '400 700' }],
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
})

/** Clases que declaran las variables CSS de ambas familias. */
export const fuentesSitio = `${bricolage.variable} ${instrumentSans.variable}`
