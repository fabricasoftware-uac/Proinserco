import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { obtenerContenedor } from '@/server/container'
import { obtenerEnv } from '@/server/env'
import { basicAuthValido, CuerpoDemasiadoGrande, leerCuerpoConLimite, respuestaError } from '@/server/http'
import { ipCliente } from '@/server/ip'
import { registro } from '@/server/registro'
import { NoImplementado } from '@/shared/domain/errores'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook de Openpay — ESQUELETO DOCUMENTADO que ya responde de forma segura.
 *
 * Openpay NO firma sus webhooks (sin HMAC ni IPs publicadas). Por eso:
 *   UN WEBHOOK ES SOLO UN AVISO, NUNCA UNA ORDEN.
 * El cuerpo solo aporta el id del cargo; el estado REAL se obtiene consultando
 * la API de Openpay con la llave privada (caso de uso conciliarDonacion), que
 * además compara importe y moneda y solo aplica transiciones válidas.
 *
 * Capas (ninguna suficiente sola): rate limit → Basic auth en tiempo constante
 * → límite de tamaño → validación mínima → consulta a la API → deduplicación
 * (transición condicional por estado).
 *
 * SALOMÓN:
 *  - Mover la ruta a /api/webhooks/openpay/[secreto] con un secreto ≥ 32 bytes
 *    aleatorios comparado en tiempo constante (404 si no coincide), y registrar
 *    esa URL + Basic auth en el dashboard de Openpay.
 *  - Encolar `{ idCargo }` y responder 200 en < 1 s; un consumidor hace la
 *    conciliación (Openpay reintenta hasta recibir 200).
 *  - Mientras PasarelaOpenpay lance NoImplementado este endpoint responde 503
 *    para que Openpay reintente y no se pierdan avisos.
 *  - Exige HTTPS con certificado válido y dominio (no IP).
 */
const MAX_BYTES = 64 * 1024

const Aviso = z.object({
  type: z.string().max(80),
  verification_code: z.string().max(100).optional(),
  transaction: z.object({ id: z.string().min(1).max(100) }).optional(),
})

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID()
  const env = obtenerEnv()
  const { transversal, donaciones } = await obtenerContenedor()

  // 1. Rate limit antes de cualquier otro trabajo (holgado: la pasarela reintenta).
  const ip = ipCliente(request.headers)
  const limite = await transversal.limitador.consumir(`webhook-openpay:ip:${ip}`, 60, 60)
  if (!limite.permitido) {
    return respuestaError(429, 'DEMASIADAS_PETICIONES', 'Inténtalo más tarde', requestId, {
      'Retry-After': String(limite.reintentarEnSegundos),
    })
  }

  // 2. Basic auth configurado en el dashboard de Openpay. Sin credenciales: endpoint apagado.
  const usuario = env.OPENPAY_WEBHOOK_USUARIO
  const contrasena = env.OPENPAY_WEBHOOK_CONTRASENA
  if (!usuario || !contrasena) return new Response(null, { status: 404 })
  if (!basicAuthValido(request.headers.get('authorization'), usuario, contrasena)) {
    registro.advertencia('Webhook Openpay con credenciales inválidas', { requestId, ip })
    return respuestaError(401, 'NO_AUTENTICADO', 'Credenciales inválidas', requestId)
  }

  // 3. Cuerpo con tope y validación mínima: solo interesa el id del cargo.
  let aviso: z.infer<typeof Aviso>
  try {
    const parseo = Aviso.safeParse(JSON.parse(await leerCuerpoConLimite(request, MAX_BYTES)))
    if (!parseo.success) return new Response(null, { status: 200 }) // desconocido: aceptar y descartar
    aviso = parseo.data
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande)
      return respuestaError(413, 'CUERPO_DEMASIADO_GRANDE', 'Cuerpo demasiado grande', requestId)
    return respuestaError(400, 'CUERPO_INVALIDO', 'Cuerpo inválido', requestId)
  }

  // 4. Alta del webhook: Openpay envía un código que se introduce en su dashboard.
  if (aviso.type === 'verification') {
    registro.info('Webhook Openpay: código de verificación recibido', {
      requestId,
      verificacion: aviso.verification_code ?? null,
    })
    return new Response(null, { status: 200 })
  }
  if (!aviso.transaction) return new Response(null, { status: 200 })

  // 5. El aviso dispara la consulta a la pasarela: lo único que cambia estados.
  try {
    const resultado = await donaciones.conciliarDonacion({ idCargo: aviso.transaction.id }, 'webhook')
    registro.info('Webhook Openpay procesado', { requestId, tipo: aviso.type, resultado: resultado.resultado })
    return new Response(null, { status: 200 })
  } catch (error) {
    registro.error('Webhook Openpay: fallo al conciliar', { requestId, error })
    const status = error instanceof NoImplementado ? 503 : 500
    return respuestaError(status, 'NO_PROCESADO', 'No se pudo procesar el aviso', requestId)
  }
}
