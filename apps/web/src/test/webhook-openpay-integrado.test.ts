import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import { crearConciliarDonacion } from '@/modules/donaciones/application/use-cases/conciliar-donacion'
import { Donacion, type DonacionId } from '@/modules/donaciones/domain/donacion'
import { crearPasarelaOpenpay } from '@/modules/donaciones/infrastructure/pasarela-openpay'
import { crearRepositorioDonacionesMemoria } from '@/modules/donaciones/infrastructure/repositorio-donaciones-memoria'
import type { Auditor } from '@/shared/application/ports/auditor'
import { importeDesdePesos } from '@/shared/domain/importe'
import { crearPublicadorEventosMemoria } from '@/shared/infrastructure/publicador-eventos-memoria'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import { crearIdsSecuenciales } from '@/test/mundo-memoria'

const { obtenerEnvMock, obtenerContenedorMock } = vi.hoisted(() => ({
  obtenerEnvMock: vi.fn(),
  obtenerContenedorMock: vi.fn(),
}))

vi.mock('@/server/env', () => ({ obtenerEnv: obtenerEnvMock }))
vi.mock('@/server/container', () => ({ obtenerContenedor: obtenerContenedorMock }))
vi.mock('@/server/registro', () => ({
  registro: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
}))

import { POST } from '@/app/api/webhooks/openpay/[secreto]/route'

const SECRETO = 's'.repeat(32)
const USUARIO = 'openpay_user'
const CONTRASENA = 'p'.repeat(24)
const AUTH_VALIDO = `Basic ${Buffer.from(`${USUARIO}:${CONTRASENA}`).toString('base64')}`

function peticion(cuerpo: string) {
  return new Request(`https://proinserco.test/api/webhooks/openpay/${SECRETO}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-real-ip': '203.0.113.10',
      authorization: AUTH_VALIDO,
    },
    body: cuerpo,
  })
}

describe('integración webhook Openpay + conciliarDonacion + PasarelaOpenpay', () => {
  const consumir = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    consumir.mockResolvedValue({ permitido: true, restantes: 59, reintentarEnSegundos: 60 })
    obtenerEnvMock.mockReturnValue({
      ADAPTADORES: 'memoria',
      DESPLIEGUE: 'directo',
      OPENPAY_WEBHOOK_SECRETO_RUTA: SECRETO,
      OPENPAY_WEBHOOK_USUARIO: USUARIO,
      OPENPAY_WEBHOOK_CONTRASENA: CONTRASENA,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ante charge.succeeded falso cuando Openpay responde in_progress/charge_pending o monto distinto, permanece pendiente sin emitir donacion.aprobada', async () => {
    const reloj = crearRelojFijo(new Date('2026-11-16T15:00:00.000Z'))
    const ids = crearIdsSecuenciales()
    const eventos = crearPublicadorEventosMemoria()
    const registroAuditoria = crearRegistroAuditoriaMemoria()
    const auditor: Auditor = { registrar: crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids }) }
    const repoDonaciones = crearRepositorioDonacionesMemoria()
    const pasarela = crearPasarelaOpenpay({
      merchantId: 'm_test_123',
      llavePrivada: 'sk_privada_super_secreta',
      urlApi: 'https://sandbox-api.openpay.co',
    })
    const conciliarReal = crearConciliarDonacion({
      donaciones: repoDonaciones,
      pasarela,
      reloj,
      eventos,
      auditor,
    })

    const creada = Donacion.crear(
      {
        id: ids.uuid() as DonacionId,
        referencia: ids.referencia(),
        claveIdempotencia: ids.uuid(),
        importe: importeDesdePesos(50_000),
        linea: 'educacion',
        donanteId: ids.uuid(),
        pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
        quiereCertificado: false,
      },
      reloj.ahora(),
    )
    await repoDonaciones.insertar(creada)
    const pendiente = creada.registrarCargo('tr_falso_1', 'https://sandbox-api.openpay.co/pay/tr_falso_1', reloj.ahora())
    await repoDonaciones.actualizarSiEstado(pendiente, 'creada')

    obtenerContenedorMock.mockResolvedValue({
      transversal: { limitador: { consumir } },
      donaciones: { conciliarDonacion: conciliarReal },
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'tr_falso_1',
            order_id: pendiente.datos.referencia,
            status: 'in_progress',
            amount: 50_000,
            currency: 'COP',
            method: 'card',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'tr_falso_1',
            order_id: pendiente.datos.referencia,
            status: 'charge_pending',
            amount: 50_000,
            currency: 'COP',
            method: 'card',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'tr_falso_1',
            order_id: pendiente.datos.referencia,
            status: 'completed',
            amount: 1_000,
            currency: 'COP',
            method: 'card',
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const bodyFalso = JSON.stringify({ type: 'charge.succeeded', transaction: { id: 'tr_falso_1' } })

    const resInProgress = await POST(peticion(bodyFalso), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(resInProgress.status).toBe(200)
    expect((await repoDonaciones.buscarPorId(pendiente.id))?.estado).toBe('pendiente')
    expect(eventos.publicados).toEqual([])

    const resChargePending = await POST(peticion(bodyFalso), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(resChargePending.status).toBe(200)
    expect((await repoDonaciones.buscarPorId(pendiente.id))?.estado).toBe('pendiente')
    expect(eventos.publicados).toEqual([])

    const resDiscrepancia = await POST(peticion(bodyFalso), { params: Promise.resolve({ secreto: SECRETO }) })
    expect(resDiscrepancia.status).toBe(200)
    expect((await repoDonaciones.buscarPorId(pendiente.id))?.estado).toBe('pendiente')
    expect(eventos.publicados.some((e) => e.tipo === 'donacion.aprobada')).toBe(false)

    const discrepancias = await registroAuditoria.listar({ accion: 'donacion.discrepancia' }, { limite: 10 })
    expect(discrepancias.total).toBe(1)
    expect(discrepancias.elementos[0]?.recursoId).toBe(pendiente.id)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
