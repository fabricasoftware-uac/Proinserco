import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Alerta } from '../application/ports/notificador'
import { crearNotificadorCompuesto, crearNotificadorRegistro } from './notificador-registro'
import { crearNotificadorWebhook } from './notificador-webhook'

const ALERTA: Alerta = {
  titulo: 'Conciliación diaria con discrepancias o errores',
  severidad: 'critica',
  detalles: { discrepancias: 2, errores: 0 },
}

describe('Notificador', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('el adaptador de log escribe las críticas como error y el resto como advertencia', async () => {
    const salida = { advertencia: vi.fn(), error: vi.fn() }
    const n = crearNotificadorRegistro(salida)
    await n.notificar(ALERTA)
    await n.notificar({ ...ALERTA, severidad: 'advertencia' })
    expect(salida.error).toHaveBeenCalledWith('ALERTA: Conciliación diaria con discrepancias o errores', {
      severidad: 'critica',
      discrepancias: 2,
      errores: 0,
    })
    expect(salida.advertencia).toHaveBeenCalledTimes(1)
  })

  it('el adaptador de webhook hace POST JSON (text/content para Slack y Discord) con timeout y sin seguir redirecciones', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await crearNotificadorWebhook({ url: 'https://hooks.ejemplo.test/T/abc' }).notificar(ALERTA)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://hooks.ejemplo.test/T/abc')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('error')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const cuerpo = JSON.parse(init.body)
    expect(cuerpo.text).toContain('[Proinserco][CRITICA] Conciliación diaria')
    expect(cuerpo.content).toBe(cuerpo.text)
    expect(cuerpo.detalles).toEqual({ discrepancias: 2, errores: 0 })
  })

  it('el webhook nunca lanza: avisa del fallo sin incluir la URL (es un secreto)', async () => {
    const alFallar = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const n = crearNotificadorWebhook({ url: 'https://hooks.ejemplo.test/T/secreto', alFallar })
    await expect(n.notificar(ALERTA)).resolves.toBeUndefined()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    await n.notificar(ALERTA)
    expect(alFallar.mock.calls).toEqual([['TypeError'], ['HTTP 500']])
    expect(JSON.stringify(alFallar.mock.calls)).not.toContain('secreto')
  })

  it('rechaza URLs http o con credenciales embebidas', () => {
    expect(() => crearNotificadorWebhook({ url: 'http://hooks.test/x' })).toThrow('https')
    expect(() => crearNotificadorWebhook({ url: 'https://u:p@hooks.test/x' })).toThrow('https')
  })

  it('el compuesto entrega a todos los canales aunque uno falle', async () => {
    const ok = { notificar: vi.fn(async () => undefined) }
    const roto = { notificar: vi.fn(async () => Promise.reject(new Error('x'))) }
    await crearNotificadorCompuesto([roto, ok]).notificar(ALERTA)
    expect(ok.notificar).toHaveBeenCalledWith(ALERTA)
  })
})
