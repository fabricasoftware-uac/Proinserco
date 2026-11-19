import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { obtenerEnvMock, obtenerContenedorMock } = vi.hoisted(() => ({
  obtenerEnvMock: vi.fn(),
  obtenerContenedorMock: vi.fn(),
}))

vi.mock('@/server/env', () => ({ obtenerEnv: obtenerEnvMock }))
vi.mock('@/server/container', () => ({ obtenerContenedor: obtenerContenedorMock }))
vi.mock('@/server/registro', () => ({
  registro: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
}))

import { POST, verificarFirmaMercadoPago } from './route'

const SECRETO_RUTA = 'm'.repeat(32)
const SECRETO_FIRMA = 'clave-secreta-webhook-mercadopago-123'

function firmar(dataId: string, requestId: string, ts: string, secreto = SECRETO_FIRMA) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', secreto).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function peticion(body: string, opciones: { dataId?: string; xSignature?: string; xRequestId?: string } = {}) {
  const dataId = opciones.dataId ?? '99887766'
  const xRequestId = opciones.xRequestId ?? 'req-123'
  const xSignature = opciones.xSignature ?? firmar(dataId, xRequestId, '1704908010')
  return new Request(`https://proinserco.org/api/webhooks/mercadopago/${SECRETO_RUTA}?data.id=${dataId}&type=payment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-real-ip': '203.0.113.20',
      'x-request-id': xRequestId,
      'x-signature': xSignature,
    },
    body,
  })
}

describe('POST /api/webhooks/mercadopago/[secreto]', () => {
  const conciliarDonacion = vi.fn()
  const consumir = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    consumir.mockResolvedValue({ permitido: true, restantes: 59, reintentarEnSegundos: 60 })
    conciliarDonacion.mockResolvedValue({ resultado: 'actualizada', estado: 'aprobada' })
    obtenerEnvMock.mockReturnValue({
      ADAPTADORES: 'memoria',
      DESPLIEGUE: 'vercel',
      MERCADOPAGO_WEBHOOK_SECRETO_RUTA: SECRETO_RUTA,
      MERCADOPAGO_WEBHOOK_FIRMA_SECRETO: SECRETO_FIRMA,
    })
    obtenerContenedorMock.mockResolvedValue({
      transversal: { limitador: { consumir } },
      donaciones: { conciliarDonacion },
    })
  })

  it('verifica firma HMAC-SHA256 x-signature y rechaza firmas alteradas o ausentes', () => {
    const sig = firmar('123456', 'req-1', '1704908010')
    expect(
      verificarFirmaMercadoPago({
        xSignature: sig,
        xRequestId: 'req-1',
        dataIdQuery: '123456',
        secretoFirma: SECRETO_FIRMA,
      }),
    ).toBe(true)
    expect(
      verificarFirmaMercadoPago({
        xSignature: sig,
        xRequestId: 'req-1',
        dataIdQuery: '999999',
        secretoFirma: SECRETO_FIRMA,
      }),
    ).toBe(false)
    expect(
      verificarFirmaMercadoPago({
        xSignature: null,
        xRequestId: 'req-1',
        dataIdQuery: '123456',
        secretoFirma: SECRETO_FIRMA,
      }),
    ).toBe(false)
  })

  it('responde 404 si el secreto de ruta no coincide y 401 si la firma HMAC es inválida', async () => {
    const r404 = await POST(peticion('{}'), { params: Promise.resolve({ secreto: 'x'.repeat(32) }) })
    expect(r404.status).toBe(404)

    const r401 = await POST(peticion('{}', { xSignature: 'ts=1704908010,v1=deadbeef' }), {
      params: Promise.resolve({ secreto: SECRETO_RUTA }),
    })
    expect(r401.status).toBe(401)
    expect(conciliarDonacion).not.toHaveBeenCalled()
  })

  it('concilia el pago cuando la firma HMAC es válida y el evento es payment', async () => {
    const body = JSON.stringify({
      type: 'payment',
      action: 'payment.updated',
      data: { id: '99887766' },
    })
    const res = await POST(peticion(body), { params: Promise.resolve({ secreto: SECRETO_RUTA }) })
    expect(res.status).toBe(200)
    expect(conciliarDonacion).toHaveBeenCalledWith({ idCargo: '99887766' }, 'webhook')
  })
})
