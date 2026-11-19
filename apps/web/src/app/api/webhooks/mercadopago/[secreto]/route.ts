import { createHmac, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { obtenerContenedor } from '@/server/container'
import { conTransaccionDb, ejecutarConContextoDb } from '@/server/db/contexto-db'
import { idempotenciaWebhooks } from '@/server/db/schema'
import { obtenerEnv } from '@/server/env'
import { CuerpoDemasiadoGrande, igualesConstante, leerCuerpoConLimite, respuestaError } from '@/server/http'
import { ipCliente } from '@/server/ip'
import { registro } from '@/server/registro'
import { NoImplementado } from '@/shared/domain/errores'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook de Mercado Pago Colombia (`/api/webhooks/mercadopago/[secreto]`).
 *
 * Capas de seguridad:
 *  1. Secreto en la ruta comparado en tiempo constante (404 si no coincide).
 *  2. Límite de tasa por IP (60/min).
 *  3. Verificación criptográfica oficial `x-signature` (HMAC-SHA256 sobre
 *     `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`) en tiempo constante (401).
 *  4. Límite de cuerpo (64 KB) + validación Zod.
 *  5. Idempotencia en `public.idempotencia_webhooks` + consulta autoritativa
 *     `GET /v1/payments/{id}` a Mercado Pago con `MERCADOPAGO_ACCESS_TOKEN`.
 */
const MAX_BYTES = 64 * 1024
const PATRON_ID_PAGO = /^[0-9]{1,40}$/
const RESULTADOS_REINTENTABLES = new Set(['no_encontrada', 'sin_cargo', 'carrera_perdida'])

const AvisoMercadoPago = z.object({
  type: z.string().trim().max(80).optional(),
  topic: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional(),
  data: z
    .object({
      id: z.union([z.string().trim().min(1).max(60), z.number().int().positive()]).transform((v) => String(v)),
    })
    .optional(),
})

function esResultadoWebhookCompletado(resultado: string | null): boolean {
  if (!resultado) return false
  if (resultado.startsWith('error:') || resultado.endsWith(':pendiente')) return false
  return !RESULTADOS_REINTENTABLES.has(resultado)
}

function formatearResultadoWebhook(resultado: { resultado: string; estado?: string }): string {
  const texto = resultado.estado ? `${resultado.resultado}:${resultado.estado}` : resultado.resultado
  return texto.slice(0, 120)
}

export function verificarFirmaMercadoPago(opciones: {
  xSignature: string | null
  xRequestId: string | null
  dataIdQuery: string | null
  secretoFirma: string
}): boolean {
  if (!opciones.xSignature || !opciones.secretoFirma) return false

  let ts = ''
  let v1 = ''
  for (const parte of opciones.xSignature.split(',')) {
    const [clave, valor] = parte.split('=', 2).map((s) => s.trim())
    if (clave === 'ts' && valor) ts = valor
    else if (clave === 'v1' && valor) v1 = valor.toLowerCase()
  }
  if (!ts || !v1) return false

  let manifest = ''
  if (opciones.dataIdQuery) manifest += `id:${opciones.dataIdQuery.toLowerCase()};`
  if (opciones.xRequestId) manifest += `request-id:${opciones.xRequestId};`
  manifest += `ts:${ts};`

  const esperado = createHmac('sha256', opciones.secretoFirma).update(manifest).digest('hex')
  return igualesConstante(esperado, v1)
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
  const secretoRuta = env.MERCADOPAGO_WEBHOOK_SECRETO_RUTA
  if (!secretoRuta || !igualesConstante(secreto, secretoRuta)) {
    return new Response(null, { status: 404 })
  }

  const requestId = randomUUID()
  const { transversal, donaciones } = await obtenerContenedor()

  const ip = ipCliente(request.headers)
  const limite = await transversal.limitador.consumir(`webhook-mercadopago:ip:${ip}`, 60, 60)
  if (!limite.permitido) {
    return respuestaError(429, 'DEMASIADAS_PETICIONES', 'Inténtalo más tarde', requestId, {
      'Retry-After': String(limite.reintentarEnSegundos),
    })
  }

  const secretoFirma = env.MERCADOPAGO_WEBHOOK_FIRMA_SECRETO
  if (!secretoFirma) return new Response(null, { status: 404 })

  const url = new URL(request.url)
  const dataIdQuery = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  const tipoQuery = url.searchParams.get('type') ?? url.searchParams.get('topic')

  const firmaValida = verificarFirmaMercadoPago({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataIdQuery,
    secretoFirma,
  })
  if (!firmaValida) {
    registro.advertencia('Webhook Mercado Pago con firma x-signature inválida', { requestId, ip })
    return respuestaError(401, 'NO_AUTENTICADO', 'Firma inválida', requestId)
  }

  let aviso: z.infer<typeof AvisoMercadoPago>
  try {
    const crudo = await leerCuerpoConLimite(request, MAX_BYTES)
    const json = crudo.trim() ? JSON.parse(crudo) : {}
    const parseo = AvisoMercadoPago.safeParse(json)
    if (!parseo.success) return new Response(null, { status: 200 })
    aviso = parseo.data
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) {
      return respuestaError(413, 'CUERPO_DEMASIADO_GRANDE', 'Cuerpo demasiado grande', requestId)
    }
    return respuestaError(400, 'CUERPO_INVALIDO', 'Cuerpo inválido', requestId)
  }

  const tipoEvento = (aviso.type ?? aviso.topic ?? tipoQuery ?? '').trim().toLowerCase()
  const idPago = (aviso.data?.id ?? dataIdQuery ?? '').trim()
  if (tipoEvento !== 'payment' || !PATRON_ID_PAGO.test(idPago)) {
    return new Response(null, { status: 200 })
  }

  const accion = (aviso.action ?? 'payment.updated').trim().toLowerCase()
  const claveIdempotencia = `mercadopago:${idPago}:${accion}`
  const usarTablaIdempotencia = env.ADAPTADORES === 'real'

  try {
    return await ejecutarConContextoDb({ modo: 'sistema' }, async () => {
      if (usarTablaIdempotencia) {
        const previo = await reclamarClaveWebhook(claveIdempotencia)
        if (esResultadoWebhookCompletado(previo)) {
          registro.info('Webhook Mercado Pago duplicado ignorado', { requestId, accion })
          return new Response(null, { status: 200 })
        }
      }

      const resultado = await donaciones.conciliarDonacion({ idCargo: idPago }, 'webhook')
      if (usarTablaIdempotencia) {
        await guardarResultadoWebhook(claveIdempotencia, formatearResultadoWebhook(resultado))
      }

      registro.info('Webhook Mercado Pago procesado', { requestId, accion, resultado: resultado.resultado })
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
    registro.error('Webhook Mercado Pago: fallo al conciliar', { requestId, error })
    const status = error instanceof NoImplementado ? 503 : 500
    return respuestaError(status, 'NO_PROCESADO', 'No se pudo procesar el aviso', requestId)
  }
}
