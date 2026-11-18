import { z } from 'zod'
import { CENTAVOS_POR_PESO, type Importe } from '@/shared/domain/importe'
import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '../application/ports/pasarela-pagos'
import { CargoRechazadoPorFraude } from '../domain/errores'

const TIMEOUT_MS = 10_000
const PATRON_ID_CARGO = /^[A-Za-z0-9_-]{1,120}$/
const PATRON_ULTIMOS_4 = /^\d{4}$/
const CODIGO_ANTIFRAUDE_OPENPAY = 3005

const HOST_SANDBOX = 'sandbox-api.openpay.co'
const HOSTS_PRODUCCION = ['api.openpay.co', 'checkout.openpay.co'] as const

const ESTADOS_OPENPAY: Readonly<Record<string, EstadoCargo>> = {
  charge_pending: 'pendiente',
  in_progress: 'pendiente',
  completed: 'aprobado',
  failed: 'rechazado',
  cancelled: 'rechazado',
  expired: 'expirado',
  refunded: 'reembolsado',
  chargeback_pending: 'contracargo',
  chargeback_accepted: 'contracargo',
  chargeback_adjustment: 'contracargo',
}

const RespuestaErrorOpenpay = z.object({
  error_code: z.number().int().optional(),
})

const RespuestaCrearCargo = z.object({
  id: z.string().min(1).max(120),
  status: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s === 'charge_pending' || s === 'in_progress', {
      message: 'Estado inicial de cargo Openpay inesperado',
    }),
  payment_method: z.object({
    url: z.string().min(1).max(2048),
  }),
})

const RespuestaConsultarCargo = z.object({
  id: z.string().min(1).max(120),
  order_id: z.string().max(120).nullable().optional(),
  status: z.string().min(1).max(60),
  amount: z.number(),
  currency: z.string().min(1).max(10),
  method: z.string().max(40).nullable().optional(),
  card: z
    .object({
      brand: z.string().max(30).nullable().optional(),
      card_number: z.string().max(30).nullable().optional(),
    })
    .nullable()
    .optional(),
})

export type ConfiguracionOpenpay = Readonly<{
  merchantId: string
  /** Llave PRIVADA. Solo servidor. Nunca en logs, nunca con NEXT_PUBLIC_. */
  llavePrivada: string
  /** https://sandbox-api.openpay.co o https://api.openpay.co (env.ts impide mezclarlas). */
  urlApi: string
  origenCheckoutExtra?: string | undefined
  alAdvertir?: ((mensaje: string, datos?: Record<string, unknown>) => void) | undefined
}>

/**
 * Convierte un `Importe` interno (centavos `bigint`) al monto entero en pesos
 * COP que exige Openpay Colombia para cargos con tarjeta.
 */
export function aPesosOpenpay(importe: Importe): number {
  if (importe.moneda !== 'COP') {
    throw new Error(`Moneda no soportada por Openpay Colombia: ${importe.moneda}`)
  }
  if (importe.centavos <= 0n) {
    throw new RangeError('El importe para Openpay debe ser mayor que cero')
  }
  if (importe.centavos % CENTAVOS_POR_PESO !== 0n) {
    throw new RangeError('Openpay Colombia exige montos en pesos enteros sin centavos')
  }
  const pesos = Number(importe.centavos / CENTAVOS_POR_PESO)
  if (!Number.isSafeInteger(pesos) || pesos <= 0) {
    throw new RangeError('El importe en pesos excede el rango entero seguro')
  }
  return pesos
}

/**
 * Reconstruye un `Importe` desde la respuesta de Openpay validando moneda COP
 * y rango positivo finito, para contrastarlo contra el monto local.
 */
export function aImporteDesdeOpenpay(amount: number, currency: string): Importe {
  if (currency !== 'COP') {
    throw new Error(`Moneda de Openpay no admitida: ${currency}`)
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('Monto devuelto por Openpay inválido')
  }
  const centavos = Math.round(amount * 100)
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new RangeError('Monto devuelto por Openpay fuera de rango seguro')
  }
  return { centavos: BigInt(centavos), moneda: 'COP' }
}

/**
 * Verifica que la URL de redirección de Openpay sea HTTPS, sin credenciales
 * embebidas y perteneciente exclusivamente a la lista blanca del entorno.
 */
export function validarUrlPagoOpenpay(urlCruda: string, urlApi: string, origenCheckoutExtra?: string): string {
  const url = parsearUrlHttpsSinCredenciales(urlCruda, 'URL de pago de Openpay inválida')
  const api = parsearUrlHttpsSinCredenciales(urlApi, 'URL de API de Openpay inválida')

  const hostsPermitidos = new Set<string>(api.hostname.toLowerCase() === HOST_SANDBOX ? [HOST_SANDBOX] : HOSTS_PRODUCCION)
  const extraLimpio = origenCheckoutExtra?.trim()
  if (extraLimpio) {
    const extra = parsearUrlHttpsSinCredenciales(extraLimpio, 'Origen extra de checkout Openpay inválido')
    hostsPermitidos.add(extra.hostname.toLowerCase())
  }

  if (!hostsPermitidos.has(url.hostname.toLowerCase())) {
    throw new Error('La URL de pago devuelta por Openpay no pertenece a un host autorizado')
  }
  return url.toString()
}

function parsearUrlHttpsSinCredenciales(cruda: string, mensajeError: string): URL {
  let url: URL
  try {
    url = new URL(cruda)
  } catch {
    throw new Error(mensajeError)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(mensajeError)
  }
  return url
}

function cabeceraBasicAuth(llavePrivada: string): string {
  return `Basic ${Buffer.from(`${llavePrivada}:`, 'utf8').toString('base64')}`
}

async function ejecutarFetchOpenpay(url: string, init: RequestInit, operacion: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    const nombre = error instanceof Error ? error.name : 'ErrorDesconocido'
    throw new Error(`Openpay ${operacion} falló por error de red (${nombre})`)
  }
}

async function leerCodigoErrorOpenpay(respuesta: Response): Promise<number | undefined> {
  const json: unknown = await respuesta.json().catch(() => null)
  const parseo = RespuestaErrorOpenpay.safeParse(json)
  return parseo.success ? parseo.data.error_code : undefined
}

async function leerJsonOpenpay(respuesta: Response, operacion: string): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch {
    throw new Error(`Openpay ${operacion} devolvió JSON inválido`)
  }
}

function extraerMetodoPagoSeguro(datos: z.infer<typeof RespuestaConsultarCargo>): string | null {
  const metodoCrudo = datos.method?.trim().toLowerCase()
  const base = metodoCrudo === 'card' ? 'tarjeta' : metodoCrudo === 'bank_account' ? 'pse' : metodoCrudo ? metodoCrudo : null

  if (!datos.card) return base ? base.slice(0, 60) : null

  const marca =
    datos.card.brand
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') || null
  const cola = datos.card.card_number?.trim().slice(-4)
  const ultimos4 = cola && PATRON_ULTIMOS_4.test(cola) ? cola : null
  const etiqueta = [base ?? 'tarjeta', marca, ultimos4 ? `•••• ${ultimos4}` : null].filter(Boolean).join(' · ')
  return etiqueta ? etiqueta.slice(0, 60) : null
}

/**
 * Adaptador real de Openpay Colombia (checkout hospedado por redirección).
 * No usa SDK externo: habla por `fetch` con Basic Auth sobre HTTPS y valida
 * todas las respuestas y URLs de salida en servidor.
 */
export function crearPasarelaOpenpay(configuracion: ConfiguracionOpenpay): PasarelaPagos {
  const urlBaseApi = configuracion.urlApi.replace(/\/$/, '')
  const autorizacion = cabeceraBasicAuth(configuracion.llavePrivada)

  const exigirConfiguracion = () => {
    if (!configuracion.merchantId || !configuracion.llavePrivada || !urlBaseApi) {
      throw new Error('Configuración de Openpay incompleta')
    }
  }

  return {
    async crearCargo(solicitud) {
      exigirConfiguracion()
      const amount = aPesosOpenpay(solicitud.importe)
      const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/charges`
      const cuerpo = JSON.stringify({
        method: 'card',
        amount,
        currency: 'COP',
        description: solicitud.descripcion,
        order_id: solicitud.referencia,
        confirm: false,
        send_email: false,
        redirect_url: solicitud.urlRetorno,
        customer: {
          name: solicitud.pagador.nombres,
          last_name: solicitud.pagador.apellidos,
          email: solicitud.pagador.correo,
        },
      })

      const respuesta = await ejecutarFetchOpenpay(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: autorizacion,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: cuerpo,
        },
        'crearCargo',
      )

      if (!respuesta.ok) {
        const errorCode = await leerCodigoErrorOpenpay(respuesta)
        if (respuesta.status === 402 && errorCode === CODIGO_ANTIFRAUDE_OPENPAY) {
          throw new CargoRechazadoPorFraude()
        }
        const sufijo = errorCode !== undefined ? ` error_code=${errorCode}` : ''
        throw new Error(`Openpay crearCargo falló con HTTP ${respuesta.status}${sufijo}`)
      }

      const json = await leerJsonOpenpay(respuesta, 'crearCargo')
      const parseado = RespuestaCrearCargo.safeParse(json)
      if (!parseado.success) {
        throw new Error('Openpay crearCargo devolvió una respuesta inesperada')
      }

      const urlPago = validarUrlPagoOpenpay(parseado.data.payment_method.url, urlBaseApi, configuracion.origenCheckoutExtra)
      return { idCargo: parseado.data.id, urlPago }
    },

    async consultarCargo(idCargo): Promise<CargoConsultado> {
      exigirConfiguracion()
      if (!PATRON_ID_CARGO.test(idCargo)) {
        throw new Error('Identificador de cargo Openpay inválido')
      }

      const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/charges/${encodeURIComponent(idCargo)}`
      const respuesta = await ejecutarFetchOpenpay(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: autorizacion,
            Accept: 'application/json',
          },
        },
        'consultarCargo',
      )

      if (!respuesta.ok) {
        const errorCode = await leerCodigoErrorOpenpay(respuesta)
        const sufijo = errorCode !== undefined ? ` error_code=${errorCode}` : ''
        throw new Error(`Openpay consultarCargo falló con HTTP ${respuesta.status}${sufijo}`)
      }

      const json = await leerJsonOpenpay(respuesta, 'consultarCargo')
      const parseado = RespuestaConsultarCargo.safeParse(json)
      if (!parseado.success) {
        throw new Error('Openpay consultarCargo devolvió una respuesta inesperada')
      }

      const datos = parseado.data
      const estadoOpenpay = datos.status.trim().toLowerCase()
      const estado = Object.hasOwn(ESTADOS_OPENPAY, estadoOpenpay) ? ESTADOS_OPENPAY[estadoOpenpay] : undefined
      if (!estado) {
        configuracion.alAdvertir?.('Openpay devolvió un estado de cargo desconocido', {
          idCargo,
          estado: estadoOpenpay,
        })
        throw new Error(`Openpay consultarCargo devolvió estado desconocido: ${estadoOpenpay}`)
      }

      return {
        idCargo: datos.id,
        referencia: datos.order_id ?? '',
        estado,
        importe: aImporteDesdeOpenpay(datos.amount, datos.currency),
        metodoPago: extraerMetodoPagoSeguro(datos),
      }
    },
  }
}
