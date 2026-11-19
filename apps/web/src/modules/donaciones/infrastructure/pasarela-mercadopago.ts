import 'server-only'
import { z } from 'zod'
import { CENTAVOS_POR_PESO, type Importe } from '@/shared/domain/importe'
import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '../application/ports/pasarela-pagos'

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com'
const TIMEOUT_MS = 10_000
const PREFIJO_PREFERENCIA = 'pref:'
const PATRON_ID_PAGO = /^[0-9]{1,40}$/
const PATRON_ID_PREFERENCIA = /^[A-Za-z0-9_-]{4,120}$/
const PATRON_ULTIMOS_4 = /^\d{4}$/

const HOSTS_CHECKOUT_PRODUCCION = new Set(['www.mercadopago.com.co', 'www.mercadopago.com'])
const HOSTS_CHECKOUT_SANDBOX = new Set([
  'sandbox.mercadopago.com.co',
  'sandbox.mercadopago.com',
  'www.mercadopago.com.co',
  'www.mercadopago.com',
])

const ESTADOS_MERCADOPAGO: Readonly<Record<string, EstadoCargo>> = {
  pending: 'pendiente',
  in_process: 'pendiente',
  authorized: 'pendiente',
  in_mediation: 'pendiente',
  approved: 'aprobado',
  rejected: 'rechazado',
  cancelled: 'rechazado',
  refunded: 'reembolsado',
  charged_back: 'contracargo',
}

const RespuestaCrearPreferencia = z.object({
  id: z.string().min(1).max(120),
  init_point: z.string().min(1).max(2048).optional(),
  sandbox_init_point: z.string().min(1).max(2048).optional(),
})

const RespuestaConsultarPreferencia = z.object({
  id: z.string().min(1).max(120),
  external_reference: z.string().max(120).nullable().optional(),
  items: z
    .array(
      z.object({
        unit_price: z.number(),
        currency_id: z.string().min(1).max(10).optional(),
      }),
    )
    .optional(),
})

const RespuestaPagoMercadoPago = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1).max(40)]).transform((v) => String(v)),
  external_reference: z.string().max(120).nullable().optional(),
  status: z.string().min(1).max(60),
  transaction_amount: z.number(),
  currency_id: z.string().min(1).max(10).nullable().optional(),
  payment_type_id: z.string().max(40).nullable().optional(),
  payment_method_id: z.string().max(40).nullable().optional(),
  card: z
    .object({
      last_four_digits: z.string().max(10).nullable().optional(),
    })
    .nullable()
    .optional(),
})

const RespuestaBusquedaPagos = z.object({
  results: z.array(RespuestaPagoMercadoPago),
})

export type ConfiguracionMercadoPago = Readonly<{
  /** Access Token privado de Mercado Pago (`APP_USR-…` o `TEST-…`). Solo servidor. */
  accessToken: string
  /** Si es true, redirige a `sandbox_init_point` para pruebas en sandbox. */
  usarSandbox?: boolean | undefined
  /** URL pública completa de nuestro webhook `/api/webhooks/mercadopago/<secreto>`. */
  urlNotificacion?: string | undefined
  alAdvertir?: ((mensaje: string, datos?: Record<string, unknown>) => void) | undefined
}>

export function aPesosMercadoPago(importe: Importe): number {
  if (importe.moneda !== 'COP') {
    throw new Error(`Moneda no soportada por Mercado Pago Colombia: ${importe.moneda}`)
  }
  if (importe.centavos <= 0n) {
    throw new RangeError('El importe para Mercado Pago debe ser mayor que cero')
  }
  if (importe.centavos % CENTAVOS_POR_PESO !== 0n) {
    throw new RangeError('Mercado Pago Colombia exige montos en pesos enteros sin centavos')
  }
  const pesos = Number(importe.centavos / CENTAVOS_POR_PESO)
  if (!Number.isSafeInteger(pesos) || pesos <= 0) {
    throw new RangeError('El importe en pesos excede el rango entero seguro')
  }
  return pesos
}

export function aImporteDesdeMercadoPago(amount: number, currency: string): Importe | null {
  if (currency.trim().toUpperCase() !== 'COP') return null
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('Monto devuelto por Mercado Pago inválido')
  }
  const centavos = Math.round(amount * 100)
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new RangeError('Monto devuelto por Mercado Pago fuera de rango seguro')
  }
  return { centavos: BigInt(centavos), moneda: 'COP' }
}

export function validarUrlCheckoutMercadoPago(urlCruda: string, usarSandbox = false): string {
  let url: URL
  try {
    url = new URL(urlCruda)
  } catch {
    throw new Error('URL de checkout de Mercado Pago inválida')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('URL de checkout de Mercado Pago inválida')
  }
  const permitidos = usarSandbox ? HOSTS_CHECKOUT_SANDBOX : HOSTS_CHECKOUT_PRODUCCION
  if (!permitidos.has(url.hostname.toLowerCase())) {
    throw new Error('La URL de pago devuelta por Mercado Pago no pertenece a un host autorizado')
  }
  return url.toString()
}

function extraerMetodoPagoSeguro(pago: z.infer<typeof RespuestaPagoMercadoPago>): string | null {
  const tipo = pago.payment_type_id?.trim().toLowerCase() ?? ''
  const metodo =
    pago.payment_method_id
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') ?? ''

  if (metodo === 'pse' || tipo === 'bank_transfer') return 'pse'
  if (tipo === 'ticket' || metodo === 'efecty') {
    return metodo ? `efectivo · ${metodo}`.slice(0, 60) : 'efectivo'
  }
  if (tipo === 'account_money') return 'mercado_pago'

  const base = tipo === 'credit_card' || tipo === 'debit_card' || tipo === 'prepaid_card' ? 'tarjeta' : metodo || tipo || null
  const ultimos4Crudo = pago.card?.last_four_digits?.trim()
  const ultimos4 = ultimos4Crudo && PATRON_ULTIMOS_4.test(ultimos4Crudo) ? ultimos4Crudo : null

  if (!ultimos4) {
    const etiqueta = [base, base === 'tarjeta' && metodo && metodo !== 'tarjeta' ? metodo : null].filter(Boolean).join(' · ')
    return etiqueta ? etiqueta.slice(0, 60) : null
  }
  const etiqueta = [base ?? 'tarjeta', metodo && metodo !== base ? metodo : null, `•••• ${ultimos4}`].filter(Boolean).join(' · ')
  return etiqueta ? etiqueta.slice(0, 60) : null
}

function traducirEstadoMercadoPago(statusCrudo: string): EstadoCargo | undefined {
  const normalizado = statusCrudo.trim().toLowerCase()
  return Object.hasOwn(ESTADOS_MERCADOPAGO, normalizado) ? ESTADOS_MERCADOPAGO[normalizado] : undefined
}

function aCargoConsultado(pago: z.infer<typeof RespuestaPagoMercadoPago>): CargoConsultado | null {
  const estado = traducirEstadoMercadoPago(pago.status)
  if (!estado) return null
  const moneda = (pago.currency_id ?? '').trim().toUpperCase().slice(0, 10)
  return {
    idCargo: pago.id,
    referencia: pago.external_reference ?? '',
    estado,
    importe: moneda ? aImporteDesdeMercadoPago(pago.transaction_amount, moneda) : null,
    monedaReportada: moneda,
    metodoPago: extraerMetodoPagoSeguro(pago),
  }
}

/** Prioridad al elegir entre varios intentos de pago de una misma referencia. */
function prioridadEstado(estado: EstadoCargo): number {
  if (estado === 'contracargo') return 5
  if (estado === 'reembolsado') return 4
  if (estado === 'aprobado') return 3
  if (estado === 'pendiente') return 2
  return 1
}

function elegirMejorPago(pagos: readonly CargoConsultado[]): CargoConsultado | null {
  let elegido: CargoConsultado | null = null
  for (const actual of pagos) {
    if (!elegido || prioridadEstado(actual.estado) > prioridadEstado(elegido.estado)) {
      elegido = actual
    }
  }
  return elegido
}

async function ejecutarFetchMercadoPago(url: string, init: RequestInit, operacion: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' })
  } catch (error) {
    const nombre = error instanceof Error ? error.name : 'ErrorDesconocido'
    throw new Error(`Mercado Pago ${operacion} falló por error de red (${nombre})`)
  }
}

async function leerJsonMercadoPago(respuesta: Response, operacion: string): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch {
    throw new Error(`Mercado Pago ${operacion} devolvió JSON inválido`)
  }
}

/**
 * Adaptador real de Mercado Pago Colombia (Checkout Pro por redirección).
 * Soporta tarjetas de crédito/débito, PSE, Efecty y saldo de Mercado Pago.
 * Ningún dato de tarjeta toca nuestro frontend ni nuestro servidor.
 */
export function crearPasarelaMercadoPago(config: ConfiguracionMercadoPago): PasarelaPagos {
  const autorizacion = `Bearer ${config.accessToken}`
  const usarSandbox = Boolean(config.usarSandbox)

  const exigirConfiguracion = () => {
    if (!config.accessToken.trim()) {
      throw new Error('Configuración de Mercado Pago incompleta (falta MERCADOPAGO_ACCESS_TOKEN)')
    }
  }

  async function getMercadoPago(url: string, operacion: string): Promise<unknown> {
    const respuesta = await ejecutarFetchMercadoPago(
      url,
      {
        method: 'GET',
        headers: { Authorization: autorizacion, Accept: 'application/json' },
      },
      operacion,
    )
    if (!respuesta.ok) {
      throw new Error(`Mercado Pago ${operacion} falló con HTTP ${respuesta.status}`)
    }
    return leerJsonMercadoPago(respuesta, operacion)
  }

  async function buscarCargoPorReferencia(referencia: string): Promise<CargoConsultado | null> {
    exigirConfiguracion()
    if (!referencia.trim() || referencia.length > 120) {
      throw new Error('Referencia inválida para Mercado Pago')
    }
    const url = `${MERCADOPAGO_API_URL}/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc&limit=10`
    const json = await getMercadoPago(url, 'buscarCargoPorReferencia')
    const parseado = RespuestaBusquedaPagos.safeParse(json)
    if (!parseado.success) {
      throw new Error('Mercado Pago buscarCargoPorReferencia devolvió una respuesta inesperada')
    }
    const coincidentes: CargoConsultado[] = []
    for (const pago of parseado.data.results) {
      if ((pago.external_reference ?? '') !== referencia) continue
      const traducido = aCargoConsultado(pago)
      if (traducido) coincidentes.push(traducido)
      else {
        config.alAdvertir?.('Mercado Pago devolvió un estado de pago desconocido en búsqueda', {
          idCargo: pago.id,
          estado: pago.status,
        })
      }
    }
    return elegirMejorPago(coincidentes)
  }

  async function consultarPagoDirecto(idPago: string): Promise<CargoConsultado> {
    const url = `${MERCADOPAGO_API_URL}/v1/payments/${encodeURIComponent(idPago)}`
    const json = await getMercadoPago(url, 'consultarCargo')
    const parseado = RespuestaPagoMercadoPago.safeParse(json)
    if (!parseado.success) {
      throw new Error('Mercado Pago consultarCargo devolvió una respuesta inesperada')
    }
    const cargo = aCargoConsultado(parseado.data)
    if (!cargo) {
      const estadoDesconocido = parseado.data.status.trim().toLowerCase()
      config.alAdvertir?.('Mercado Pago devolvió un estado de pago desconocido', {
        idCargo: idPago,
        estado: estadoDesconocido,
      })
      throw new Error(`Mercado Pago consultarCargo devolvió estado desconocido: ${estadoDesconocido}`)
    }
    return cargo
  }

  async function consultarPreferencia(idPreferencia: string): Promise<CargoConsultado> {
    const url = `${MERCADOPAGO_API_URL}/checkout/preferences/${encodeURIComponent(idPreferencia)}`
    const json = await getMercadoPago(url, 'consultarCargo')
    const parseado = RespuestaConsultarPreferencia.safeParse(json)
    if (!parseado.success) {
      throw new Error('Mercado Pago consultarCargo devolvió una preferencia inesperada')
    }
    const ref = parseado.data.external_reference ?? ''
    if (ref) {
      const pago = await buscarCargoPorReferencia(ref)
      if (pago) return pago
    }
    const item = parseado.data.items?.[0]
    const moneda = (item?.currency_id ?? 'COP').trim().toUpperCase().slice(0, 10)
    const importe = item ? aImporteDesdeMercadoPago(item.unit_price, moneda) : null
    return {
      idCargo: `${PREFIJO_PREFERENCIA}${parseado.data.id}`,
      referencia: ref,
      estado: 'pendiente',
      importe,
      monedaReportada: moneda,
      metodoPago: null,
    }
  }

  return {
    async crearCargo(solicitud) {
      exigirConfiguracion()
      const montoPesos = aPesosMercadoPago(solicitud.importe)
      const url = `${MERCADOPAGO_API_URL}/checkout/preferences`
      const cuerpo: Record<string, unknown> = {
        items: [
          {
            id: solicitud.referencia,
            title: solicitud.descripcion,
            quantity: 1,
            currency_id: 'COP',
            unit_price: montoPesos,
          },
        ],
        payer: {
          name: solicitud.pagador.nombres,
          surname: solicitud.pagador.apellidos,
          email: solicitud.pagador.correo,
        },
        external_reference: solicitud.referencia,
        back_urls: {
          success: solicitud.urlRetorno,
          pending: solicitud.urlRetorno,
          failure: solicitud.urlRetorno,
        },
        auto_return: 'approved',
        statement_descriptor: 'PROINSERCO',
      }
      if (config.urlNotificacion) {
        cuerpo.notification_url = `${config.urlNotificacion}?source_news=webhooks`
      }

      const respuesta = await ejecutarFetchMercadoPago(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: autorizacion,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(cuerpo),
        },
        'crearCargo',
      )

      if (!respuesta.ok) {
        throw new Error(`Mercado Pago crearCargo falló con HTTP ${respuesta.status}`)
      }

      const json = await leerJsonMercadoPago(respuesta, 'crearCargo')
      const parseado = RespuestaCrearPreferencia.safeParse(json)
      if (!parseado.success) {
        throw new Error('Mercado Pago crearCargo devolvió una respuesta inesperada')
      }

      const urlCruda = usarSandbox
        ? (parseado.data.sandbox_init_point ?? parseado.data.init_point ?? '')
        : (parseado.data.init_point ?? '')
      if (!urlCruda) {
        throw new Error('Mercado Pago crearCargo no devolvió URL de checkout')
      }

      const urlPago = validarUrlCheckoutMercadoPago(urlCruda, usarSandbox)
      return { idCargo: `${PREFIJO_PREFERENCIA}${parseado.data.id}`, urlPago }
    },

    async consultarCargo(idCargo): Promise<CargoConsultado> {
      exigirConfiguracion()
      if (idCargo.startsWith(PREFIJO_PREFERENCIA)) {
        const prefId = idCargo.slice(PREFIJO_PREFERENCIA.length)
        if (!PATRON_ID_PREFERENCIA.test(prefId)) {
          throw new Error('Identificador de preferencia Mercado Pago inválido')
        }
        return consultarPreferencia(prefId)
      }
      if (!PATRON_ID_PAGO.test(idCargo)) {
        throw new Error('Identificador de pago Mercado Pago inválido')
      }
      return consultarPagoDirecto(idCargo)
    },

    buscarCargoPorReferencia,

    async listarCargos({ desde, hasta }): Promise<readonly CargoConsultado[]> {
      exigirConfiguracion()
      const url = `${MERCADOPAGO_API_URL}/v1/payments/search?range=date_created&begin_date=${encodeURIComponent(desde.toISOString())}&end_date=${encodeURIComponent(hasta.toISOString())}&sort=date_created&criteria=desc&limit=100`
      const json = await getMercadoPago(url, 'listarCargos')
      const parseado = RespuestaBusquedaPagos.safeParse(json)
      if (!parseado.success) {
        throw new Error('Mercado Pago listarCargos devolvió una respuesta inesperada')
      }
      const resultados: CargoConsultado[] = []
      for (const pago of parseado.data.results) {
        const traducido = aCargoConsultado(pago)
        if (traducido) resultados.push(traducido)
        else {
          config.alAdvertir?.('Mercado Pago devolvió un estado de pago desconocido en listado', {
            idCargo: pago.id,
            estado: pago.status,
          })
        }
      }
      return resultados
    },
  }
}
