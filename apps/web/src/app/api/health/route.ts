/**
 * Health check para Coolify/Docker. Responde sin tocar datos ni revelar
 * versión, modo ni dependencias (información útil para un atacante).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET(): Response {
  return Response.json({ estado: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
