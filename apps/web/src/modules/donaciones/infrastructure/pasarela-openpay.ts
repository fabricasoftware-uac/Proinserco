import 'server-only'
import { z } from 'zod'
import { CENTAVOS_POR_PESO, type Importe } from '@/shared/domain/importe'
import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '../application/ports/pasarela-pagos'
import { CargoRechazadoPorFraude } from '../domain/errores'

const TIMEOUT_MS = 10_000
const PATRON_ID_CARGO = /^[A-Za-z0-9_-]{1,120}$/
const PATRON_ULTIMOS_4 = /^\d{4}$/
const PATRON_REFERENCIA = /^DON-[0-9A-HJKMNP-TV-Z]{21}$/
const TAMANO_PAGINA_LISTADO = 100
const MAX_PAGINAS_LISTADO = 50
const CODIGO_ANTIFRAUDE_OPENPAY = 3005

const HOST_SANDBOX = 'sandbox-api.openpay.co'
const HOSTS_PRODUCCION = ['api.openpay.co', 'checkout.openpay.co'] as const

const ESTADOS_OPENPAY: Readonly<Record<string, EstadoCargo>> = {
  available: 'pendiente',
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

const RespuestaCrearCargo = z
  .object({
    id: z.string().min(1).max(120),
    status: z
      .string()
      .transform((s) => s.trim().toLowerCase())
      .refine((s) => s === 'available' || s === 'charge_pending' || s === 'in_progress', {
        message: 'Estado inicial de cargo Openpay inesperado',
      }),
    checkout_link: z.string().min(1).max(2048).optional(),
    payment_method: z
      .object({
        url: z.string().min(1).max(2048),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.checkout_link ?? d.payment_method?.url), {
    message: 'Falta URL de redirección en respuesta de Openpay',
  })

const RespuestaConsultarCargo = z.object({
  id: z.string().min(1).max(120),
  order_id: z.string().max(120).nullable().optional(),
  status: z.string().min(1).max(60),
  amount: z.number(),
  currency: z.string().min(1).max(10).optional(),
  method: z.string().max(40).nullable().optional(),
  card: z
    .object({
      brand: z.string().max(30).nullable().optional(),
      card_number: z.string().max(30).nullable().optional(),
    })
    .nullable()
    .optional(),
})

/**
 * Checkout multimétodo (`ck…`). El estado que cuenta es el de la transacción embebida
 * (`transaction`), que trae el método real (tarjeta, PSE o efectivo). Sin transacción,
 * el checkout solo informa que sigue disponible, expiró o se canceló.
 */
const RespuestaConsultarCheckout = z.object({
  id: z.string().min(1).max(120),
  order_id: z.string().max(120).nullable().optional(),
  status: z.string().min(1).max(60),
  amount: z.number(),
  currency: z.string().min(1).max(10),
  transaction: RespuestaConsultarCargo.nullable().optional(),
})

/** El listado de cargos es un arreglo; cada elemento se valida por separado. */
const RespuestaListaCargos = z.array(z.unknown()).max(1000)

/** Estados que un checkout SIN transacción nunca puede reportar por sí solo. */
const ESTADOS_SOLO_CON_TRANSACCION: ReadonlySet<EstadoCargo> = new Set(['aprobado', 'reembolsado', 'contracargo'])

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
 * Reconstruye un `Importe` desde la respuesta de Openpay validando rango positivo
 * finito, para contrastarlo contra el monto local. Una moneda distinta de COP NO
 * lanza (eso provocaría un 500 y reintentos en bucle del webhook): devuelve `null`
 * y la conciliación la registra como discrepancia sin tocar el estado.
 */
export function aImporteDesdeOpenpay(amount: number, currency: string): Importe | null {
  if (currency.trim().toUpperCase() !== 'COP') return null
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
  const base =
    metodoCrudo === 'card'
      ? 'tarjeta'
      : metodoCrudo === 'bank_account' || metodoCrudo === 'pse'
        ? 'pse'
        : metodoCrudo === 'store' || metodoCrudo === 'paynet_charge'
          ? 'efectivo'
          : metodoCrudo
            ? metodoCrudo
            : null

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

/** Traduce el `status` crudo de Openpay. `undefined` si es desconocido (nunca se mapea a aprobado). */
function traducirEstado(statusCrudo: string): EstadoCargo | undefined {
  const estadoOpenpay = statusCrudo.trim().toLowerCase()
  return Object.hasOwn(ESTADOS_OPENPAY, estadoOpenpay) ? ESTADOS_OPENPAY[estadoOpenpay] : undefined
}

/** Datos del checkout que contiene la transacción, leídos de la MISMA respuesta de la API. */
type RespaldoCheckout = Readonly<{ referencia?: string | null | undefined; moneda?: string | undefined }>

/**
 * Único traductor de una transacción de Openpay (cargo directo, transacción embebida en
 * un checkout o elemento de un listado) al puerto. `null` si el estado es desconocido.
 * Sin moneda en la transacción ni en su checkout, el importe queda `null` y la
 * conciliación lo registra como discrepancia: nunca se aprueba.
 */
function aCargoConsultado(
  datos: z.infer<typeof RespuestaConsultarCargo>,
  respaldo: RespaldoCheckout = {},
): CargoConsultado | null {
  const estado = traducirEstado(datos.status)
  if (!estado) return null
  const moneda = (datos.currency ?? respaldo.moneda ?? '').trim().toUpperCase().slice(0, 10)
  return {
    idCargo: datos.id,
    referencia: datos.order_id ?? respaldo.referencia ?? '',
    estado,
    importe: moneda ? aImporteDesdeOpenpay(datos.amount, moneda) : null,
    monedaReportada: moneda,
    metodoPago: extraerMetodoPagoSeguro(datos),
  }
}

/** Los ids de checkout multimétodo de Openpay empiezan por `ck`; el resto son cargos directos. */
function esIdCheckout(id: string): boolean {
  return id.toLowerCase().startsWith('ck')
}

/** Openpay filtra el listado por fecha de creación con `yyyy-mm-dd` (UTC). */
function fechaOpenpay(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

/**
 * Adaptador real de Openpay Colombia (checkout hospedado multimétodo por redirección:
 * tarjeta de crédito/débito, PSE y efectivo/corresponsales).
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

  async function getOpenpay(url: string, operacion: string): Promise<unknown> {
    const respuesta = await ejecutarFetchOpenpay(
      url,
      { method: 'GET', headers: { Authorization: autorizacion, Accept: 'application/json' } },
      operacion,
    )
    if (!respuesta.ok) {
      const errorCode = await leerCodigoErrorOpenpay(respuesta)
      const sufijo = errorCode !== undefined ? ` error_code=${errorCode}` : ''
      throw new Error(`Openpay ${operacion} falló con HTTP ${respuesta.status}${sufijo}`)
    }
    return leerJsonOpenpay(respuesta, operacion)
  }

  /** En una consulta puntual, un estado desconocido se avisa y LANZA: nunca se adivina. */
  function exigirEstadoConocido(cargo: CargoConsultado | null, idCargo: string, statusCrudo: string): CargoConsultado {
    if (cargo) return cargo
    const estadoOpenpay = statusCrudo.trim().toLowerCase()
    configuracion.alAdvertir?.('Openpay devolvió un estado de cargo desconocido', { idCargo, estado: estadoOpenpay })
    throw new Error(`Openpay consultarCargo devolvió estado desconocido: ${estadoOpenpay}`)
  }

  async function consultarCargoDirecto(idCargo: string, respaldo: RespaldoCheckout = {}): Promise<CargoConsultado> {
    const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/charges/${encodeURIComponent(idCargo)}`
    const json = await getOpenpay(url, 'consultarCargo')
    const parseado = RespuestaConsultarCargo.safeParse(json)
    if (!parseado.success) {
      throw new Error('Openpay consultarCargo devolvió una respuesta inesperada')
    }
    return exigirEstadoConocido(aCargoConsultado(parseado.data, respaldo), idCargo, parseado.data.status)
  }

  async function consultarCheckout(idCheckout: string): Promise<CargoConsultado> {
    const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/checkouts/${encodeURIComponent(idCheckout)}`
    const json = await getOpenpay(url, 'consultarCargo')
    const parseado = RespuestaConsultarCheckout.safeParse(json)
    if (!parseado.success) {
      throw new Error('Openpay consultarCargo devolvió una respuesta inesperada')
    }

    const checkout = parseado.data
    const respaldo: RespaldoCheckout = { referencia: checkout.order_id, moneda: checkout.currency }
    const tx = checkout.transaction
    if (tx) {
      // Tarjeta sin detalle embebido: /charges/{id} solo amplía marca y últimos 4.
      // Si falla, vale la transacción embebida (viene de la misma consulta autenticada).
      if (tx.method?.trim().toLowerCase() === 'card' && !tx.card && PATRON_ID_CARGO.test(tx.id) && !esIdCheckout(tx.id)) {
        try {
          return await consultarCargoDirecto(tx.id, respaldo)
        } catch {
          // Se sigue con la transacción embebida.
        }
      }
      return exigirEstadoConocido(aCargoConsultado(tx, respaldo), tx.id, tx.status)
    }

    // Sin transacción no hay pago que probar: el estado del checkout nunca aprueba ni revierte.
    const cargo = exigirEstadoConocido(aCargoConsultado(checkout), checkout.id, checkout.status)
    if (!ESTADOS_SOLO_CON_TRANSACCION.has(cargo.estado)) return cargo
    configuracion.alAdvertir?.('Checkout de Openpay sin transacción con estado de pago; se trata como pendiente', {
      idCargo: checkout.id,
      estado: cargo.estado,
    })
    return { ...cargo, estado: 'pendiente' }
  }

  return {
    async crearCargo(solicitud) {
      exigirConfiguracion()
      const amount = aPesosOpenpay(solicitud.importe)
      const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/checkouts`
      const cuerpo = JSON.stringify({
        amount,
        currency: 'COP',
        description: solicitud.descripcion,
        order_id: solicitud.referencia,
        iva: '0',
        send_email: 'false',
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

      const urlCruda = parseado.data.checkout_link ?? parseado.data.payment_method?.url ?? ''
      const urlPago = validarUrlPagoOpenpay(urlCruda, urlBaseApi, configuracion.origenCheckoutExtra)
      return { idCargo: parseado.data.id, urlPago }
    },

    async consultarCargo(idCargo): Promise<CargoConsultado> {
      exigirConfiguracion()
      if (!PATRON_ID_CARGO.test(idCargo)) {
        throw new Error('Identificador de cargo Openpay inválido')
      }

      return esIdCheckout(idCargo) ? consultarCheckout(idCargo) : consultarCargoDirecto(idCargo)
    },

    async buscarCargoPorReferencia(referencia) {
      exigirConfiguracion()
      if (!PATRON_REFERENCIA.test(referencia)) {
        throw new Error('Referencia de donación inválida para buscar en Openpay')
      }
      // Con checkout multimétodo se busca en /charges: lo que se paga es la transacción
      // (`tr…`) que el checkout crea con nuestro `order_id`, no el checkout (`ck…`).
      const consulta = new URLSearchParams({ order_id: referencia, offset: '0', limit: '10' })
      const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/charges?${consulta.toString()}`
      const json = await getOpenpay(url, 'buscarCargoPorReferencia')
      const lista = RespuestaListaCargos.safeParse(json)
      if (!lista.success) {
        throw new Error('Openpay buscarCargoPorReferencia devolvió una respuesta inesperada')
      }
      // Filtro defensivo: si la API ignorara `order_id`, nunca se atribuye un cargo ajeno.
      const candidatos = lista.data
        .map((crudo) => RespuestaConsultarCargo.safeParse(crudo))
        .flatMap((r) => (r.success && r.data.order_id === referencia ? [r.data] : []))
      if (candidatos.length > 1) {
        configuracion.alAdvertir?.('Openpay devolvió varios cargos con la misma referencia', {
          referencia,
          cantidad: candidatos.length,
        })
      }
      const primero = candidatos[0]
      return primero ? aCargoConsultado(primero) : null
    },

    async listarCargos({ desde, hasta }) {
      exigirConfiguracion()
      const cargos: CargoConsultado[] = []
      for (let pagina = 0; pagina < MAX_PAGINAS_LISTADO; pagina += 1) {
        const consulta = new URLSearchParams({
          'creation[gte]': fechaOpenpay(desde),
          'creation[lte]': fechaOpenpay(hasta),
          offset: String(pagina * TAMANO_PAGINA_LISTADO),
          limit: String(TAMANO_PAGINA_LISTADO),
        })
        const url = `${urlBaseApi}/v1/${encodeURIComponent(configuracion.merchantId)}/charges?${consulta.toString()}`
        const json = await getOpenpay(url, 'listarCargos')
        const lista = RespuestaListaCargos.safeParse(json)
        if (!lista.success) {
          throw new Error('Openpay listarCargos devolvió una respuesta inesperada')
        }
        for (const crudo of lista.data) {
          const parseo = RespuestaConsultarCargo.safeParse(crudo)
          const cargo = parseo.success ? aCargoConsultado(parseo.data) : null
          if (cargo) cargos.push(cargo)
          else configuracion.alAdvertir?.('Cargo de Openpay omitido en el listado (forma o estado desconocido)', {})
        }
        if (lista.data.length < TAMANO_PAGINA_LISTADO) return cargos
      }
      configuracion.alAdvertir?.('Listado de cargos de Openpay truncado', { maximo: MAX_PAGINAS_LISTADO * TAMANO_PAGINA_LISTADO })
      return cargos
    },
  }
}
