/**
 * Content Security Policy con nonce (vault: 03 - Seguridad/Cabeceras y CSP).
 * Sin `server-only`: la usa src/proxy.ts. Función pura y testeada.
 *
 * Orígenes de terceros permitidos: SOLO Cloudflare Turnstile
 * (script + iframe del desafío). Nada más: fuentes e imágenes son propias.
 */
const TURNSTILE = 'https://challenges.cloudflare.com'

export type OpcionesCsp = Readonly<{
  nonce: string
  esDesarrollo: boolean
  esHttps: boolean
}>

export function construirCsp({ nonce, esDesarrollo, esHttps }: OpcionesCsp): string {
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
    // SALOMÓN: cuando se conozca el host del checkout hospedado de Openpay, añadirlo
    // aquí: sin JavaScript, el formulario de donar hace un POST que redirige a la
    // pasarela y Chrome aplica form-action también a esa redirección.
    `form-action 'self'`,
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
