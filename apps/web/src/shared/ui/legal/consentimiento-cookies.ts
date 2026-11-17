/**
 * Consentimiento de cookies (opt-in). Sin 'use client': lo importan el banner
 * y cualquier futura analítica. Solo funciona en el navegador.
 *
 * Cookie propia de primera parte, necesaria: guarda la decisión, la versión
 * del texto mostrado y la fecha (prueba de la elección). No contiene datos
 * personales.
 */

export const NOMBRE_COOKIE_CONSENTIMIENTO = 'proinserco_consentimiento'
/** Cambia al modificar categorías o texto de forma sustancial: obliga a volver a preguntar. */
export const VERSION_CONSENTIMIENTO = '2026-11-16'
export const EVENTO_CONSENTIMIENTO = 'cookies:consentimiento'
export const EVENTO_ABRIR_COOKIES = 'cookies:abrir'
const SEIS_MESES_SEGUNDOS = 60 * 60 * 24 * 30 * 6

export type CategoriasCookies = Readonly<{
  /** Siempre true: sin ellas el sitio no funciona. */
  necesarias: true
  preferencias: boolean
  analitica: boolean
}>

export type Consentimiento = Readonly<{
  version: string
  /** ISO 8601 */
  fecha: string
  categorias: CategoriasCookies
}>

export const SIN_OPCIONALES = { preferencias: false, analitica: false } as const
export const TODAS = { preferencias: true, analitica: true } as const

function leerCookie(nombre: string): string | null {
  for (const parte of document.cookie.split('; ')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i) === nombre) return parte.slice(i + 1)
  }
  return null
}

function esConsentimiento(v: unknown): v is Consentimiento {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const c = o.categorias as Record<string, unknown> | undefined
  return (
    typeof o.version === 'string' &&
    typeof o.fecha === 'string' &&
    typeof c === 'object' &&
    c !== null &&
    typeof c.preferencias === 'boolean' &&
    typeof c.analitica === 'boolean'
  )
}

/**
 * Decisión vigente o `null` si no hay (o es de una versión anterior del texto).
 * Una analítica futura debe llamar a esto y, además, escuchar `EVENTO_CONSENTIMIENTO`.
 */
export function leerConsentimiento(): Consentimiento | null {
  if (typeof document === 'undefined') return null
  try {
    const bruto = leerCookie(NOMBRE_COOKIE_CONSENTIMIENTO)
    if (!bruto) return null
    const dato: unknown = JSON.parse(decodeURIComponent(bruto))
    if (!esConsentimiento(dato) || dato.version !== VERSION_CONSENTIMIENTO) return null
    return {
      version: dato.version,
      fecha: dato.fecha,
      categorias: { necesarias: true, preferencias: dato.categorias.preferencias, analitica: dato.categorias.analitica },
    }
  } catch {
    return null
  }
}

/** Guarda la decisión y avisa a quien escuche (`window` → `cookies:consentimiento`). */
export function guardarConsentimiento(categorias: Readonly<{ preferencias: boolean; analitica: boolean }>): Consentimiento {
  const consentimiento: Consentimiento = {
    version: VERSION_CONSENTIMIENTO,
    fecha: new Date().toISOString(),
    categorias: { necesarias: true, preferencias: categorias.preferencias, analitica: categorias.analitica },
  }
  // Secure en HTTPS (producción); en http://localhost el navegador la descartaría.
  const seguro = window.location.protocol === 'https:' ? '; Secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API aún no está en todos los navegadores
  document.cookie = `${NOMBRE_COOKIE_CONSENTIMIENTO}=${encodeURIComponent(JSON.stringify(consentimiento))}; Path=/; Max-Age=${SEIS_MESES_SEGUNDOS}; SameSite=Lax${seguro}`
  window.dispatchEvent(new CustomEvent<Consentimiento>(EVENTO_CONSENTIMIENTO, { detail: consentimiento }))
  return consentimiento
}

/** Para el enlace "Preferencias de cookies" del pie: reabre el banner. */
export function abrirPreferenciasCookies(): void {
  window.dispatchEvent(new Event(EVENTO_ABRIR_COOKIES))
}
