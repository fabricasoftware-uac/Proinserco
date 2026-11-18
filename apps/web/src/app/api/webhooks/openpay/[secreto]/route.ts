import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { obtenerContenedor } from '@/server/container'
import { conTransaccionDb, ejecutarConContextoDb } from '@/server/db/contexto-db'
import { idempotenciaWebhooks } from '@/server/db/schema'
import { obtenerEnv } from '@/server/env'
import { basicAuthValido, CuerpoDemasiadoGrande, igualesConstante, leerCuerpoConLimite, respuestaError } from '@/server/http'
import { ipCliente } from '@/server/ip'
import { registro } from '@/server/registro'
import { NoImplementado } from '@/shared/domain/errores'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook de Openpay Colombia con secreto en ruta (`/api/webhooks/openpay/[secreto]`).
 *
 * Openpay NO firma sus webhooks con HMAC. Por eso:
 *   UN WEBHOOK ES SOLO UN AVISO, NUNCA UNA ORDEN.
 * El cuerpo solo aporta el id del cargo; el estado REAL se obtiene consultando
 * la API de Openpay con la llave privada (`conciliarDonacion`), que además
 * compara referencia, importe y moneda y solo aplica transiciones válidas.
 *
 * Capas: secreto en ruta (404) → rate limit por IP → Basic auth en tiempo constante
 * → límite de 64 KB → validación mínima → idempotencia sin bloquear reintentos tras
 * error → consulta autoritativa a Openpay.
 */
const MAX_BYTES = 64 * 1024

const Aviso = z.object({
  type: z.string().trim().min(1).max(80),
  verification_code: z.string().max(100).optional(),
  transaction: z.object({ id: z.string().trim().min(1).max(100) }).optional(),
})

const RESULTADOS_REINTENTABLES = new Set(['no_encontrada', 'sin_cargo', 'carrera_perdida'])

function esResultadoWebhookCompletado(resultado: string | null): boolean {
  if (!resultado) return false
  if (resultado.startsWith('error:') || resultado.endsWith(':pendiente')) return false
  return !RESULTADOS_REINTENTABLES.has(resultado)
}

function formatearResultadoWebhook(resultado: { resultado: string; estado?: string }): string {
  const texto = resultado.estado ? `${resultado.resultado}:${resultado.estado}` : resultado.resultado
  return texto.slice(0, 120)
}

async function reclamarClaveWebhook(clave: string): Promise<string | null> {
  const ahora = new Date()
  const [fila] = await conTransaccionDb((tx) =>
    tx
      .insert(idempotenciaWebhooks)
      .values({ clave, resultado: null, creadoEn: ahora, actualizadoEn: ahora })
      .onConflictDoUpdate({
        target: idempotenciaWebhooks.clave,
        set: { actualizadoEn: ahora },
      })
      .returning({ resultado: idempotenciaWebhooks.resultado }),
  )
  return fila?.resultado ?? null
}

async function guardarResultadoWebhook(clave: string, resultado: string): Promise<void> {
  const ahora = new Date()
  await conTransaccionDb((tx) =>
    tx
      .update(idempotenciaWebhooks)
      .set({ resultado: resultado.slice(0, 120), actualizadoEn: ahora })
      .where(eq(idempotenciaWebhooks.clave, clave)),
  )
}

export async function POST(request: Request, context: { params: Promise<{ secreto: string }> }): Promise<Response> {
  const env = obtenerEnv()
  const { secreto } = await context.params
  const secretoRuta = env.OPENPAY_WEBHOOK_SECRETO_RUTA
  if (!secretoRuta || !igualesConstante(secreto, secretoRuta)) {
    return new Response(null, { status: 404 })
  }

  const requestId = randomUUID()
  const { transversal, donaciones } = await obtenerContenedor()

  // 1. Rate limit antes de procesar cuerpo (holgado: la pasarela reintenta).
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
    if (error instanceof CuerpoDemasiadoGrande) {
      return respuestaError(413, 'CUERPO_DEMASIADO_GRANDE', 'Cuerpo demasiado grande', requestId)
    }
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

  // 5. Idempotencia + consulta autoritativa a Openpay bajo rol de sistema.
  const idCargo = aviso.transaction.id
  const claveIdempotencia = `openpay:${idCargo}:${aviso.type}`
  const usarTablaIdempotencia = env.ADAPTADORES === 'real'

  try {
    return await ejecutarConContextoDb({ modo: 'sistema' }, async () => {
      if (usarTablaIdempotencia) {
        const previo = await reclamarClaveWebhook(claveIdempotencia)
        if (esResultadoWebhookCompletado(previo)) {
          registro.info('Webhook Openpay duplicado ignorado', { requestId, tipo: aviso.type })
          return new Response(null, { status: 200 })
        }
      }

      const resultado = await donaciones.conciliarDonacion({ idCargo }, 'webhook')
      if (usarTablaIdempotencia) {
        await guardarResultadoWebhook(claveIdempotencia, formatearResultadoWebhook(resultado))
      }

      registro.info('Webhook Openpay procesado', { requestId, tipo: aviso.type, resultado: resultado.resultado })
      return new Response(null, { status: 200 })
    })
  } catch (error) {
    if (usarTablaIdempotencia) {
      await ejecutarConContextoDb({ modo: 'sistema' }, () =>
        guardarResultadoWebhook(
          claveIdempotencia,
          error instanceof NoImplementado ? 'error:no_implementado' : 'error:conciliacion',
        ),
      ).catch(() => undefined)
    }
    registro.error('Webhook Openpay: fallo al conciliar', { requestId, error })
    const status = error instanceof NoImplementado ? 503 : 500
    return respuestaError(status, 'NO_PROCESADO', 'No se pudo procesar el aviso', requestId)
  }
}
