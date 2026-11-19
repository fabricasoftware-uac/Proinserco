import { afterEach, describe, expect, it, vi } from 'vitest'
import { importeDesdePesos } from '@/shared/domain/importe'
import {
  aImporteDesdeMercadoPago,
  aPesosMercadoPago,
  crearPasarelaMercadoPago,
  validarUrlCheckoutMercadoPago,
} from './pasarela-mercadopago'

const CONFIG_PROD = {
  accessToken: 'APP_USR-secreto-test-123',
  usarSandbox: false,
  urlNotificacion: 'https://proinserco.org/api/webhooks/mercadopago/secreto123',
}

function solicitudBase() {
  return {
    referencia: 'DON-000000000000000000001',
    importe: importeDesdePesos(50_000),
    descripcion: 'Donación a la Fundación Proinserco',
    pagador: { nombres: 'Ana María', apellidos: 'Muñoz', correo: 'ana.munoz@correo.test' },
    urlRetorno: 'https://proinserco.org/donar/resultado?referencia=DON-000000000000000000001',
  }
}

describe('conversión y validación Mercado Pago Colombia', () => {
  it('convierte COP enteros a pesos y reconstruye Importe validando moneda', () => {
    expect(aPesosMercadoPago(importeDesdePesos(50_000))).toBe(50_000)
    expect(() => aPesosMercadoPago({ centavos: 50_050n, moneda: 'COP' })).toThrow('pesos enteros')
    expect(aImporteDesdeMercadoPago(50_000, 'COP')).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
    expect(aImporteDesdeMercadoPago(50_000, 'USD')).toBeNull()
  })

  it('valida hosts autorizados para Checkout Pro en producción y sandbox', () => {
    expect(validarUrlCheckoutMercadoPago('https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=1', false)).toContain(
      'www.mercadopago.com.co',
    )
    expect(() =>
      validarUrlCheckoutMercadoPago('https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=1', false),
    ).toThrow('host autorizado')
    expect(validarUrlCheckoutMercadoPago('https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=1', true)).toContain(
      'sandbox.mercadopago.com.co',
    )
    expect(() => validarUrlCheckoutMercadoPago('https://atacante.test/pay', true)).toThrow('host autorizado')
  })
})

describe('adaptador PasarelaMercadoPago', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('crearCargo crea preferencia en Checkout Pro y devuelve pref:<id> e init_point validado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '123456-abc-def',
          init_point: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=123456-abc-def',
          sandbox_init_point: 'https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=123456-abc-def',
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaMercadoPago(CONFIG_PROD)
    const res = await pasarela.crearCargo(solicitudBase())

    expect(res).toEqual({
      idCargo: 'pref:123456-abc-def',
      urlPago: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=123456-abc-def',
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer APP_USR-secreto-test-123')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.external_reference).toBe('DON-000000000000000000001')
    expect(body.notification_url).toBe('https://proinserco.org/api/webhooks/mercadopago/secreto123?source_news=webhooks')
  })

  it('consultarCargo soporta pagos directos (numéricos) con tarjeta, PSE y Efecty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 99887766,
            external_reference: 'DON-000000000000000000001',
            status: 'approved',
            transaction_amount: 50_000,
            currency_id: 'COP',
            payment_type_id: 'credit_card',
            payment_method_id: 'visa',
            card: { last_four_digits: '4242' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 99887767,
            external_reference: 'DON-000000000000000000001',
            status: 'in_process',
            transaction_amount: 50_000,
            currency_id: 'COP',
            payment_type_id: 'bank_transfer',
            payment_method_id: 'pse',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 99887768,
            external_reference: 'DON-000000000000000000001',
            status: 'pending',
            transaction_amount: 50_000,
            currency_id: 'COP',
            payment_type_id: 'ticket',
            payment_method_id: 'efecty',
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaMercadoPago(CONFIG_PROD)

    expect(await pasarela.consultarCargo('99887766')).toEqual({
      idCargo: '99887766',
      referencia: 'DON-000000000000000000001',
      estado: 'aprobado',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'tarjeta · visa · •••• 4242',
    })

    expect(await pasarela.consultarCargo('99887767')).toEqual({
      idCargo: '99887767',
      referencia: 'DON-000000000000000000001',
      estado: 'pendiente',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'pse',
    })

    expect(await pasarela.consultarCargo('99887768')).toEqual({
      idCargo: '99887768',
      referencia: 'DON-000000000000000000001',
      estado: 'pendiente',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'efectivo · efecty',
    })
  })

  it('consultarCargo para una preferencia (pref:...) resuelve el pago asociado por external_reference o devuelve pendiente', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '123456-abc',
            external_reference: 'DON-000000000000000000001',
            items: [{ unit_price: 50_000, currency_id: 'COP' }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 555001,
                external_reference: 'DON-000000000000000000001',
                status: 'approved',
                transaction_amount: 50_000,
                currency_id: 'COP',
                payment_type_id: 'bank_transfer',
                payment_method_id: 'pse',
              },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaMercadoPago(CONFIG_PROD)
    const cargo = await pasarela.consultarCargo('pref:123456-abc')
    expect(cargo).toEqual({
      idCargo: '555001',
      referencia: 'DON-000000000000000000001',
      estado: 'aprobado',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'pse',
    })
  })
})
