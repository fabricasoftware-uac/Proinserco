import { afterEach, describe, expect, it, vi } from 'vitest'
import { importeDesdePesos } from '@/shared/domain/importe'
import { Donacion, type DonacionId } from '../domain/donacion'
import { crearEnviadorCorreosResend } from './correos-donacion-resend'

const AHORA = new Date('2026-11-18T20:00:00.000Z')

function construirDonacionAprobada(quiereCertificado = true): Donacion {
  const creada = Donacion.crear(
    {
      id: '11111111-1111-4111-8111-111111111111' as DonacionId,
      referencia: 'DON-0123456789ABCDEFGHJKM',
      claveIdempotencia: '22222222-2222-4222-8222-222222222222',
      importe: importeDesdePesos(150_000),
      linea: 'educacion',
      donanteId: '33333333-3333-4333-8333-333333333333',
      pagador: {
        nombres: 'Ana <script>alert(1)</script>',
        apellidos: 'Muñoz',
        correo: 'ana@donante.test',
      },
      quiereCertificado,
    },
    AHORA,
  )
  return creada
    .registrarCargo('ck_123', 'https://sandbox-api.openpay.co/ck/123', AHORA)
    .transicionar('aprobada', AHORA, 'webhook', { metodoPago: 'pse' })
}

describe('crearEnviadorCorreosResend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envía recibo al donante y aviso interno con Idempotency-Key, escapando HTML y destacando certificado', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const enviador = crearEnviadorCorreosResend({
      apiKey: 're_secreto_123456',
      desde: 'Fundación Proinserco <donaciones@proinserco.org>',
      urlBase: 'https://proinserco.org',
      correoInterno: 'admin@proinserco.org',
    })

    await enviador.enviarDonacionAprobada(construirDonacionAprobada(true))

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [urlDonante, initDonante] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(urlDonante).toBe('https://api.resend.com/emails')
    const headersDonante = initDonante.headers as Record<string, string>
    expect(headersDonante.Authorization).toBe('Bearer re_secreto_123456')
    expect(headersDonante['Idempotency-Key']).toBe('donacion-aprobada-donante-DON-0123456789ABCDEFGHJKM')

    const cuerpoDonante = JSON.parse(String(initDonante.body)) as {
      from: string
      to: string[]
      subject: string
      html: string
      text: string
    }
    expect(cuerpoDonante.to).toEqual(['ana@donante.test'])
    expect(cuerpoDonante.subject).toContain('DON-0123456789ABCDEFGHJKM')
    expect(cuerpoDonante.html).not.toContain('<script>')
    expect(cuerpoDonante.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(cuerpoDonante.html).toContain('Solicitaste certificado de donación')

    const [, initInterno] = fetchMock.mock.calls[1] as [string, RequestInit]
    const headersInterno = initInterno.headers as Record<string, string>
    expect(headersInterno['Idempotency-Key']).toBe('donacion-aprobada-interno-DON-0123456789ABCDEFGHJKM')
    const cuerpoInterno = JSON.parse(String(initInterno.body)) as {
      to: string[]
      subject: string
      html: string
    }
    expect(cuerpoInterno.to).toEqual(['admin@proinserco.org'])
    expect(cuerpoInterno.subject).toContain('[CERTIFICADO SOLICITADO]')
    expect(cuerpoInterno.html).toContain('certificado tributario')
  })

  it('no lanza ni expone la API key si Resend responde error HTTP o falla la red', async () => {
    const alFallar = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
        .mockRejectedValueOnce(new TypeError('fetch failed')),
    )

    const enviador = crearEnviadorCorreosResend({
      apiKey: 're_secreto_no_filtrar',
      desde: 'Fundación Proinserco <donaciones@proinserco.org>',
      urlBase: 'https://proinserco.org',
      correoInterno: 'admin@proinserco.org',
      alFallar,
    })

    await expect(enviador.enviarDonacionAprobada(construirDonacionAprobada(false))).resolves.toBeUndefined()
    expect(alFallar).toHaveBeenCalledTimes(2)
    expect(alFallar).toHaveBeenNthCalledWith(1, 'HTTP 401', {
      referencia: 'DON-0123456789ABCDEFGHJKM',
      destino: 'donante',
    })
    expect(alFallar).toHaveBeenNthCalledWith(2, 'TypeError', {
      referencia: 'DON-0123456789ABCDEFGHJKM',
      destino: 'interno',
    })
    expect(JSON.stringify(alFallar.mock.calls)).not.toContain('re_secreto_no_filtrar')
  })
})
