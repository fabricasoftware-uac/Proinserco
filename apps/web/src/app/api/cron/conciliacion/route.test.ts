import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registro } from '@/server/registro'

const { obtenerEnvMock, obtenerContenedorMock, obtenerContextoDbMock } = vi.hoisted(() => ({
  obtenerEnvMock: vi.fn(),
  obtenerContenedorMock: vi.fn(),
  obtenerContextoDbMock: vi.fn(),
}))

vi.mock('@/server/env', () => ({ obtenerEnv: obtenerEnvMock }))
vi.mock('@/server/container', () => ({ obtenerContenedor: obtenerContenedorMock }))
vi.mock('@/server/registro', () => ({
  registro: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
}))
vi.mock('@/server/db/contexto-db', async () => {
  const actual = await vi.importActual<typeof import('@/server/db/contexto-db')>('@/server/db/contexto-db')
  return {
    ...actual,
    ejecutarConContextoDb: vi.fn((ctx, fn) => {
      obtenerContextoDbMock(ctx)
      return actual.ejecutarConContextoDb(ctx, fn)
    }),
  }
})

import { POST } from './route'

const SECRETO = 'c'.repeat(32)

function peticion(auth: string | null = `Bearer ${SECRETO}`) {
  const headers = new Headers()
  if (auth !== null) headers.set('authorization', auth)
  return new Request('https://proinserco.test/api/cron/conciliacion', { method: 'POST', headers })
}

describe('POST /api/cron/conciliacion', () => {
  const conciliarPendientes = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    conciliarPendientes.mockResolvedValue({
      revisadas: 4,
      actualizadas: 2,
      expiradas: 1,
      discrepancias: 0,
      errores: 0,
    })
    obtenerEnvMock.mockReturnValue({
      DESPLIEGUE: 'directo',
      CRON_CONCILIACION_SECRETO: SECRETO,
    })
    obtenerContenedorMock.mockResolvedValue({
      donaciones: { conciliarPendientes },
    })
  })

  it('responde 404 si CRON_CONCILIACION_SECRETO no está configurado', async () => {
    obtenerEnvMock.mockReturnValueOnce({ DESPLIEGUE: 'directo', CRON_CONCILIACION_SECRETO: undefined })
    const r = await POST(peticion())
    expect(r.status).toBe(404)
    expect(conciliarPendientes).not.toHaveBeenCalled()
  })

  it('responde 401 si falta Authorization Bearer, tiene longitud distinta, esquema incorrecto o no coincide', async () => {
    expect((await POST(peticion(null))).status).toBe(401)
    expect((await POST(peticion('Bearer c'))).status).toBe(401)
    expect((await POST(peticion(`Bearer ${SECRETO}extra`))).status).toBe(401)
    expect((await POST(peticion('Bearer '))).status).toBe(401)
    expect((await POST(peticion('Bearer incorrecto'))).status).toBe(401)
    expect((await POST(peticion(`bearer ${SECRETO}`))).status).toBe(401)
    expect((await POST(peticion(`Basic ${SECRETO}`))).status).toBe(401)
    expect((await POST(peticion(`Token ${SECRETO}`))).status).toBe(401)
    expect(conciliarPendientes).not.toHaveBeenCalled()
  })

  it('ejecuta conciliarPendientes en modo sistema y responde 200 JSON con no-store', async () => {
    const r = await POST(peticion())
    expect(r.status).toBe(200)
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    expect(obtenerContextoDbMock).toHaveBeenCalledWith({ modo: 'sistema' })
    expect(await r.json()).toEqual({
      revisadas: 4,
      actualizadas: 2,
      expiradas: 1,
      discrepancias: 0,
      errores: 0,
    })
  })

  it('responde 500 genérico sin filtrar detalles internos ni secretos si conciliarPendientes lanza error', async () => {
    conciliarPendientes.mockRejectedValueOnce(new Error('Fallo interno postgres://usuario:clave@db:5432/proinserco'))

    const r = await POST(peticion())
    expect(r.status).toBe(500)
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    const requestId = r.headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()

    const cuerpo = (await r.json()) as { error: { code: string; message: string; requestId: string } }
    expect(cuerpo).toEqual({
      error: {
        code: 'ERROR_INTERNO',
        message: 'No se pudo ejecutar la conciliación',
        requestId,
      },
    })

    const textoRespuesta = JSON.stringify(cuerpo)
    expect(textoRespuesta).not.toContain('postgres://')
    expect(textoRespuesta).not.toContain('clave')
    expect(textoRespuesta).not.toContain(SECRETO)

    const logs = JSON.stringify([
      ...vi.mocked(registro.info).mock.calls,
      ...vi.mocked(registro.advertencia).mock.calls,
      ...vi.mocked(registro.error).mock.calls,
    ])
    expect(vi.mocked(registro.error)).toHaveBeenCalledTimes(1)
    expect(logs).not.toContain(SECRETO)
    expect(logs.toLowerCase()).not.toContain('authorization')
  })
})
