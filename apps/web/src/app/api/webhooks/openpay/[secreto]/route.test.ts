import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseDatos } from '@/server/db/cliente'
import * as schema from '@/server/db/schema'
import { registro } from '@/server/registro'
import { NoImplementado } from '@/shared/domain/errores'

const { obtenerEnvMock, obtenerContenedorMock, obtenerDbMock } = vi.hoisted(() => ({
  obtenerEnvMock: vi.fn(),
  obtenerContenedorMock: vi.fn(),
  obtenerDbMock: vi.fn<() => BaseDatos>(),
}))

vi.mock('@/server/env', () => ({ obtenerEnv: obtenerEnvMock }))
vi.mock('@/server/container', () => ({ obtenerContenedor: obtenerContenedorMock }))
vi.mock('@/server/db/cliente', () => ({ obtenerDb: obtenerDbMock }))
vi.mock('@/server/registro', () => ({
  registro: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
}))

import { POST } from './route'

const SECRETO = 's'.repeat(32)
const USUARIO = 'openpay_user'
const CONTRASENA = 'p'.repeat(24)
const AUTH_VALIDO = `Basic ${Buffer.from(`${USUARIO}:${CONTRASENA}`).toString('base64')}`

function crearDbMock(respondedor: (sql: string, params: unknown[]) => unknown[]) {
  const consultas: Array<{ sql: string; params: unknown[] }> = []
  const unsafe = (query: string, params: unknown[] = []) => {
    consultas.push({ sql: query, params })
    const filas = respondedor(query, params)
    return Object.assign(Promise.resolve(filas), {
      values: async () => filas,
    })
  }
  const clienteFalso = {
    options: { parsers: {} as Record<string, unknown>, serializers: {} as Record<string, unknown> },
    unsafe,
    begin: async <T>(cb: (txClient: { unsafe: typeof unsafe }) => Promise<T>) => cb({ unsafe }),
  }
  return { db: drizzle(clienteFalso as unknown as Sql, { schema }), consultas }
}

function peticion(cuerpo: string, auth: string | null = AUTH_VALIDO) {
  const headers = new Headers({ 'content-type': 'application/json', 'x-real-ip': '203.0.113.10' })
  if (auth !== null) headers.set('authorization', auth)
  return new Request(`https://proinserco.test/api/webhooks/openpay/${SECRETO}`, {
    method: 'POST',
    headers,
    body: cuerpo,
  })
}

describe('POST /api/webhooks/openpay/[secreto]', () => {
  const conciliarDonacion = vi.fn()
  const consumir = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    consumir.mockResolvedValue({ permitido: true, restantes: 59, reintentarEnSegundos: 60 })
    conciliarDonacion.mockResolvedValue({ resultado: 'actualizada', estado: 'aprobada' })
    obtenerEnvMock.mockReturnValue({
      ADAPTADORES: 'real',
      DESPLIEGUE: 'directo',
      OPENPAY_WEBHOOK_SECRETO_RUTA: SECRETO,
      OPENPAY_WEBHOOK_USUARIO: USUARIO,
      OPENPAY_WEBHOOK_CONTRASENA: CONTRASENA,
    })
    obtenerContenedorMock.mockResolvedValue({
      transversal: { limitador: { consumir } },
      donaciones: { conciliarDonacion },
    })
  })

  it('responde 404 si falta el secreto de ruta o no coincide', async () => {
    obtenerEnvMock.mockReturnValueOnce({ OPENPAY_WEBHOOK_SECRETO_RUTA: undefined })
    const rSinConfig = await POST(peticion('{}'), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rSinConfig.status).toBe(404)

    const rIncorrecto = await POST(peticion('{}'), { params: Promise.resolve({ secreto: 'x'.repeat(32) }) })
    expect(rIncorrecto.status).toBe(404)
    expect(obtenerContenedorMock).not.toHaveBeenCalled()
  })

  it('responde 404 si faltan credenciales Basic y 401 si son inválidas', async () => {
    obtenerEnvMock.mockReturnValueOnce({
      ADAPTADORES: 'real',
      DESPLIEGUE: 'directo',
      OPENPAY_WEBHOOK_SECRETO_RUTA: SECRETO,
      OPENPAY_WEBHOOK_USUARIO: undefined,
      OPENPAY_WEBHOOK_CONTRASENA: undefined,
    })
    const rSinCreds = await POST(peticion('{}'), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rSinCreds.status).toBe(404)

    const rMalaAuth = await POST(peticion('{}', 'Basic invalido'), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rMalaAuth.status).toBe(401)
  })

  it('responde 413 si supera 64 KB y 200 en verification o evento desconocido', async () => {
    const grande = 'x'.repeat(65 * 1024)
    const rGrande = await POST(peticion(grande), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rGrande.status).toBe(413)

    const rVerif = await POST(peticion(JSON.stringify({ type: 'verification', verification_code: 'XYZ' })), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(rVerif.status).toBe(200)

    const rDesconocido = await POST(peticion(JSON.stringify({ otro: 1 })), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(rDesconocido.status).toBe(200)
    expect(conciliarDonacion).not.toHaveBeenCalled()
  })

  it('registra en idempotencia_webhooks, concilia y deduplica solo resultados exitosos definitivos', async () => {
    const { db, consultas } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [[null]]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    const body = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_999' } })
    const r1 = await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(r1.status).toBe(200)
    expect(conciliarDonacion).toHaveBeenCalledWith({ idCargo: 'tr_999' }, 'webhook')
    expect(consultas.some((c) => c.sql.includes('insert into "idempotencia_webhooks"'))).toBe(true)
    expect(consultas.some((c) => c.sql.includes('update "idempotencia_webhooks"'))).toBe(true)

    // Duplicado ya completado -> 200 sin volver a llamar a Openpay
    conciliarDonacion.mockClear()
    const { db: dbDup } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [['actualizada:aprobada']]
      return []
    })
    obtenerDbMock.mockReturnValue(dbDup)

    const rDup = await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rDup.status).toBe(200)
    expect(conciliarDonacion).not.toHaveBeenCalled()
  })

  it('pasa transaction.order_id como referencia de RESPALDO (solo si tiene formato DON-) para recuperar donaciones sin idCargo', async () => {
    const { db } = crearDbMock((sql) => (sql.includes('insert into "idempotencia_webhooks"') ? [[null]] : []))
    obtenerDbMock.mockReturnValue(db)

    const ref = 'DON-0123456789ABCDEFGHJKM'
    const conRef = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_1', order_id: ref } })
    expect((await POST(peticion(conRef), { params: Promise.resolve({ secreto: SECRETO }) })).status).toBe(200)
    expect(conciliarDonacion).toHaveBeenLastCalledWith({ idCargo: 'tr_1', referenciaRespaldo: ref }, 'webhook')

    const refBasura = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_2', order_id: "' OR 1=1 --" } })
    expect((await POST(peticion(refBasura), { params: Promise.resolve({ secreto: SECRETO }) })).status).toBe(200)
    expect(conciliarDonacion).toHaveBeenLastCalledWith({ idCargo: 'tr_2', referenciaRespaldo: undefined }, 'webhook')
  })

  it('una discrepancia (p. ej. moneda distinta de COP) responde 200: Openpay no reintenta en bucle', async () => {
    const { db } = crearDbMock((sql) => (sql.includes('insert into "idempotencia_webhooks"') ? [[null]] : []))
    obtenerDbMock.mockReturnValue(db)
    conciliarDonacion.mockResolvedValueOnce({ resultado: 'discrepancia', estado: 'pendiente' })
    const body = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_usd' } })
    expect((await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO }) })).status).toBe(200)
  })

  it('no bloquea reintentos si la ejecución previa terminó con error y responde 503 en NoImplementado', async () => {
    const { db: dbErrorPrevio } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [['error:conciliacion']]
      return []
    })
    obtenerDbMock.mockReturnValue(dbErrorPrevio)

    const body = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_reintento' } })
    const rReintento = await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(rReintento.status).toBe(200)
    expect(conciliarDonacion).toHaveBeenCalledWith({ idCargo: 'tr_reintento' }, 'webhook')

    conciliarDonacion.mockRejectedValueOnce(new NoImplementado('test'))
    const { db: db503, consultas: consultas503 } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [[null]]
      return []
    })
    obtenerDbMock.mockReturnValue(db503)

    const r503 = await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(r503.status).toBe(503)
    expect(consultas503.some((c) => c.params.includes('error:no_implementado'))).toBe(true)
  })

  it('no marca como completado en idempotencia_webhooks un resultado pendiente ni discrepancia', async () => {
    const { db, consultas } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [[null]]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    conciliarDonacion.mockResolvedValueOnce({ resultado: 'sin_cambios', estado: 'pendiente' })
    const rPend = await POST(peticion(JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_pend_1' } })), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(rPend.status).toBe(200)
    expect(consultas.some((c) => c.params.includes('sin_cambios:pendiente'))).toBe(true)

    conciliarDonacion.mockClear()
    const { db: dbReintento } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [['sin_cambios:pendiente']]
      return []
    })
    obtenerDbMock.mockReturnValue(dbReintento)
    conciliarDonacion.mockResolvedValueOnce({ resultado: 'actualizada', estado: 'aprobada' })

    const rReintento = await POST(peticion(JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_pend_1' } })), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(rReintento.status).toBe(200)
    expect(conciliarDonacion).toHaveBeenCalledTimes(1)
  })

  it('nunca registra PAN (13-19 dígitos), CVV, contraseña del webhook ni Authorization en logs', async () => {
    const { db } = crearDbMock((sql) => {
      if (sql.includes('insert into "idempotencia_webhooks"')) return [[null]]
      return []
    })
    obtenerDbMock.mockReturnValue(db)

    // 1. Auth inválido con cabecera Authorization Basic + cuerpo con PAN/CVV
    const authMalicioso = `Basic ${Buffer.from('atacante:clave_secreta_999').toString('base64')}`
    const res401 = await POST(peticion('{"card_number":"4532015112830366","cvv2":"123"}', authMalicioso), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(res401.status).toBe(401)

    // 2. Auth válido + JSON malformado con PAN y CVV
    const res400 = await POST(peticion('{"card_number":"4532015112830366","cvv2":"123"'), {
      params: Promise.resolve({ secreto: SECRETO }),
    })
    expect(res400.status).toBe(400)

    // 3. Auth válido + payload válido acompañado de campos de tarjeta
    const res200 = await POST(
      peticion(
        JSON.stringify({
          type: 'charge.succeeded',
          transaction: { id: 'tr_seguro_1' },
          card: { card_number: '4532015112830366', cvv2: '123' },
        }),
      ),
      { params: Promise.resolve({ secreto: SECRETO }) },
    )
    expect(res200.status).toBe(200)

    const llamadas = [
      ...vi.mocked(registro.info).mock.calls,
      ...vi.mocked(registro.advertencia).mock.calls,
      ...vi.mocked(registro.error).mock.calls,
    ]
    const serializado = JSON.stringify(llamadas)
    const sinRequestIds = serializado.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')

    expect(serializado).not.toMatch(/\d{13,19}/)
    expect(serializado).not.toContain('4532015112830366')
    expect(serializado.toLowerCase()).not.toContain('cvv')
    expect(sinRequestIds).not.toContain('123')
    expect(serializado).not.toContain(CONTRASENA)
    expect(serializado).not.toContain(SECRETO)
    expect(serializado).not.toContain(AUTH_VALIDO)
    expect(serializado).not.toContain(authMalicioso)
    expect(serializado.toLowerCase()).not.toContain('authorization')
  })
})
