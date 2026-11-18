import { randomUUID } from 'node:crypto'
import { obtenerContenedor } from '@/server/container'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { obtenerEnv } from '@/server/env'
import { bearerTokenValido, respuestaError } from '@/server/http'
import { ipCliente } from '@/server/ip'
import { registro } from '@/server/registro'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Endpoint protegido para el cron de conciliación diaria de donaciones.
 * Exige `CRON_CONCILIACION_SECRETO` y `Authorization: Bearer <secreto>`
 * validado en tiempo constante.
 */
export async function POST(request: Request): Promise<Response> {
  const env = obtenerEnv()
  const secreto = env.CRON_CONCILIACION_SECRETO
  if (!secreto) {
    return new Response(null, { status: 404 })
  }

  const requestId = randomUUID()
  if (!bearerTokenValido(request.headers.get('authorization'), secreto)) {
    registro.advertencia('Cron conciliación con credenciales inválidas', {
      requestId,
      ip: ipCliente(request.headers),
    })
    return respuestaError(401, 'NO_AUTENTICADO', 'Credenciales inválidas', requestId)
  }

  try {
    const { donaciones } = await obtenerContenedor()
    const resumen = await ejecutarConContextoDb({ modo: 'sistema' }, () => donaciones.conciliarPendientes())
    registro.info('Cron de conciliación completado', { requestId, ...resumen })
    return Response.json(resumen, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    })
  } catch (error) {
    registro.error('Cron de conciliación falló', { requestId, error })
    return respuestaError(500, 'ERROR_INTERNO', 'No se pudo ejecutar la conciliación', requestId)
  }
}
