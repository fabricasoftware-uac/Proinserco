/**
 * Content Security Policy con nonce (vault: 03 - Seguridad/Cabeceras y CSP).
 * Sin `server-only`: la usa src/proxy.ts. Función pura y testeada.
 *
 * Orígenes de terceros permitidos:
 *  - Cloudflare Turnstile (script + iframe del desafío).
 *  - Openpay Colombia SOLO en `form-action` (redirección del formulario POST
 *    sin JavaScript hacia el checkout hospedado). Nunca en `script-src`,
 *    `connect-src` ni `frame-src`.
 */
const TURNSTILE = 'https://challenges.cloudflare.com'
const OPENPAY_SANDBOX = 'https://sandbox-api.openpay.co'
const OPENPAY_PRODUCCION = ['https://api.openpay.co', 'https://checkout.openpay.co'] as const

export type OpcionesCsp = Readonly<{
  nonce: string
  esDesarrollo: boolean
  esHttps: boolean
  openpaySandbox?: boolean | undefined
  origenCheckoutOpenpay?: string | undefined
}>

/** Valida que un origen opcional use HTTPS sin credenciales y devuelve solo `origin`. */
export function normalizarOrigenHttps(valor: string | undefined): string | null {
  const limpio = valor?.trim()
  if (!limpio) return null
  try {
    const url = new URL(limpio)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function construirCsp({ nonce, esDesarrollo, esHttps, openpaySandbox, origenCheckoutOpenpay }: OpcionesCsp): string {
  const origenesFormAction = new Set<string>([
    "'self'",
    ...(esDesarrollo ? [OPENPAY_SANDBOX] : OPENPAY_PRODUCCION),
    ...(openpaySandbox ? [OPENPAY_SANDBOX] : []),
  ])
  const origenExtra = normalizarOrigenHttps(origenCheckoutOpenpay)
  if (origenExtra) origenesFormAction.add(origenExtra)

  const directivas = [
    `default-src 'self'`,
    // 'strict-dynamic': lo que carga un script con nonce hereda la confianza (así funciona
    // Next sin abrir dominios). El host de Turnstile queda como respaldo para navegadores
    // sin strict-dynamic. 'unsafe-eval' SOLO en desarrollo (React lo usa para depurar).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}${esDesarrollo ? ` 'unsafe-eval'` : ''}`,
    // Estilos en línea: los necesitan next/font, Tailwind y GSAP (style="transform…").
    // Riesgo aceptado y acotado: no hay inyección de CSS que ejecute código.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'${esDesarrollo ? ' ws:' : ''}`,
    `frame-src ${TURNSTILE}`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action ${[...origenesFormAction].join(' ')}`,
    `frame-ancestors 'none'`,
  ]
  if (esHttps) directivas.push('upgrade-insecure-requests')
  return directivas.join('; ')
}

/** Nonce de 128 bits por petición, en base64. Web Crypto: válido en cualquier runtime. */
export function generarNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
