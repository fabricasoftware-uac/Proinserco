/**
 * Ruta pública heredada deshabilitada: el webhook de Openpay migró a
 * `/api/webhooks/openpay/[secreto]` para exigir un secreto aleatorio de ruta
 * además de la autenticación Basic y la verificación contra la API de Openpay.
 */
export const dynamic = 'force-dynamic'

export function GET(): Response {
  return new Response(null, { status: 404 })
}

export function POST(): Response {
  return new Response(null, { status: 404 })
}
