import { afterEach, describe, expect, it, vi } from 'vitest'
import { importeDesdePesos } from '@/shared/domain/importe'
import { CargoRechazadoPorFraude } from '../domain/errores'
import { aImporteDesdeOpenpay, aPesosOpenpay, crearPasarelaOpenpay, validarUrlPagoOpenpay } from './pasarela-openpay'

const CONFIG_SANDBOX = {
  merchantId: 'm_test_123',
  llavePrivada: 'sk_privada_super_secreta',
  urlApi: 'https://sandbox-api.openpay.co',
}

function solicitudBase() {
  return {
    referencia: 'DON-000000000000000000001',
    importe: importeDesdePesos(50_000),
    descripcion: 'Donación a la Fundación Proinserco',
    pagador: { nombres: 'Ana María', apellidos: 'Muñoz', correo: 'ana.munoz@correo.test' },
    urlRetorno: 'https://proinserco.test/donar/resultado?referencia=DON-000000000000000000001',
  }
}

describe('conversión COP Openpay', () => {
  it('aPesosOpenpay convierte pesos enteros sin decimales desde centavos COP', () => {
    expect(aPesosOpenpay(importeDesdePesos(50_000))).toBe(50_000)
    expect(() => aPesosOpenpay({ centavos: 50_050n, moneda: 'COP' })).toThrow('pesos enteros')
    expect(() => aPesosOpenpay({ centavos: 0n, moneda: 'COP' })).toThrow('mayor que cero')
    expect(() => aPesosOpenpay({ centavos: 100n, moneda: 'USD' as 'COP' })).toThrow('Moneda no soportada')
  })

  it('aImporteDesdeOpenpay reconvierte COP a centavos bigint', () => {
    expect(aImporteDesdeOpenpay(50_000, 'COP')).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
    expect(aImporteDesdeOpenpay(50_000.5, 'COP')).toEqual({ centavos: 5_000_050n, moneda: 'COP' })
    // Otra moneda NO lanza (evita 500 y reintentos en bucle del webhook): null = discrepancia.
    expect(aImporteDesdeOpenpay(50_000, 'USD')).toBeNull()
    expect(aImporteDesdeOpenpay(50_000, 'cop')).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
    expect(() => aImporteDesdeOpenpay(0, 'COP')).toThrow('inválido')
    expect(() => aImporteDesdeOpenpay(Number.POSITIVE_INFINITY, 'COP')).toThrow('inválido')
  })
})

describe('validarUrlPagoOpenpay', () => {
  it('acepta solo hosts de sandbox en sandbox y de producción en producción', () => {
    expect(validarUrlPagoOpenpay('https://sandbox-api.openpay.co/pay/1', 'https://sandbox-api.openpay.co')).toBe(
      'https://sandbox-api.openpay.co/pay/1',
    )
    expect(() => validarUrlPagoOpenpay('https://api.openpay.co/pay/1', 'https://sandbox-api.openpay.co')).toThrow(
      'host autorizado',
    )

    expect(validarUrlPagoOpenpay('https://api.openpay.co/pay/1', 'https://api.openpay.co')).toBe('https://api.openpay.co/pay/1')
    expect(validarUrlPagoOpenpay('https://checkout.openpay.co/pay/1', 'https://api.openpay.co')).toBe(
      'https://checkout.openpay.co/pay/1',
    )
    expect(() => validarUrlPagoOpenpay('https://sandbox-api.openpay.co/pay/1', 'https://api.openpay.co')).toThrow(
      'host autorizado',
    )
  })

  it('rechaza http, credenciales en URL y hosts externos, pero permite origenCheckoutExtra https', () => {
    expect(() => validarUrlPagoOpenpay('http://sandbox-api.openpay.co/pay/1', 'https://sandbox-api.openpay.co')).toThrow()
    expect(() =>
      validarUrlPagoOpenpay('https://user:pass@sandbox-api.openpay.co/pay/1', 'https://sandbox-api.openpay.co'),
    ).toThrow()
    expect(() => validarUrlPagoOpenpay('https://atacante.test/pay/1', 'https://api.openpay.co')).toThrow()

    expect(validarUrlPagoOpenpay('https://pagos.openpay.co/pay/1', 'https://api.openpay.co', 'https://pagos.openpay.co')).toBe(
      'https://pagos.openpay.co/pay/1',
    )
  })
})

describe('adaptador PasarelaOpenpay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('crearCargo envía petición al endpoint multimétodo /checkouts con Basic Auth y pesos COP enteros y valida la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ck_abc123',
          status: 'available',
          checkout_link: 'https://sandbox-api.openpay.co/ck/NC5bUY54aYlT',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    const res = await pasarela.crearCargo(solicitudBase())

    expect(res).toEqual({
      idCargo: 'ck_abc123',
      urlPago: 'https://sandbox-api.openpay.co/ck/NC5bUY54aYlT',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://sandbox-api.openpay.co/v1/m_test_123/checkouts')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('sk_privada_super_secreta:').toString('base64')}`,
    )
    expect(JSON.parse(String(init.body))).toEqual({
      amount: 50_000,
      currency: 'COP',
      description: 'Donación a la Fundación Proinserco',
      order_id: 'DON-000000000000000000001',
      iva: '0',
      send_email: 'false',
      redirect_url: 'https://proinserco.test/donar/resultado?referencia=DON-000000000000000000001',
      customer: {
        name: 'Ana María',
        last_name: 'Muñoz',
        email: 'ana.munoz@correo.test',
      },
    })
  })

  it('consultarCargo soporta checkouts multimétodo (ck...) disponibles y completados por PSE o efectivo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ck_disponible_1',
            order_id: 'DON-000000000000000000001',
            status: 'available',
            amount: 50_000,
            currency: 'COP',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ck_pse_1',
            order_id: 'DON-000000000000000000001',
            status: 'completed',
            amount: 50_000,
            currency: 'COP',
            transaction: {
              id: 'tr_pse_99',
              order_id: 'DON-000000000000000000001',
              status: 'completed',
              amount: 50_000,
              method: 'bank_account',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ck_efectivo_1',
            order_id: 'DON-000000000000000000001',
            status: 'available',
            amount: 50_000,
            currency: 'COP',
            transaction: {
              id: 'tr_store_88',
              order_id: 'DON-000000000000000000001',
              status: 'in_progress',
              amount: 50_000,
              method: 'paynet_charge',
            },
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)

    expect(await pasarela.consultarCargo('ck_disponible_1')).toEqual({
      idCargo: 'ck_disponible_1',
      referencia: 'DON-000000000000000000001',
      estado: 'pendiente',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: null,
    })

    expect(await pasarela.consultarCargo('ck_pse_1')).toEqual({
      idCargo: 'tr_pse_99',
      referencia: 'DON-000000000000000000001',
      estado: 'aprobado',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'pse',
    })

    expect(await pasarela.consultarCargo('ck_efectivo_1')).toEqual({
      idCargo: 'tr_store_88',
      referencia: 'DON-000000000000000000001',
      estado: 'pendiente',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'efectivo',
    })
  })

  it('crearCargo traduce HTTP 402 error_code 3005 a CargoRechazadoPorFraude', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ http_code: 402, error_code: 3005, description: 'Fraud detected' }), { status: 402 }),
        ),
    )

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    await expect(pasarela.crearCargo(solicitudBase())).rejects.toThrow(CargoRechazadoPorFraude)
  })

  it('crearCargo ante otros errores HTTP no filtra PII, cuerpo ni llave en el mensaje', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_code: 1001, description: 'Bad request' }), { status: 400 })),
    )

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    let capturado: unknown
    try {
      await pasarela.crearCargo(solicitudBase())
    } catch (error) {
      capturado = error
    }
    expect(capturado).toBeInstanceOf(Error)
    const msg = (capturado as Error).message
    expect(msg).toContain('400')
    expect(msg).toContain('1001')
    expect(msg).not.toContain('ana.munoz@correo.test')
    expect(msg).not.toContain('sk_privada_super_secreta')
    expect(msg).not.toContain('Authorization')
  })

  it('crearCargo rechaza URLs de pago fuera de la lista blanca', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'tr_abc123',
            status: 'in_progress',
            payment_method: { url: 'https://evil.test/steal' },
          }),
          { status: 200 },
        ),
      ),
    )

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    await expect(pasarela.crearCargo(solicitudBase())).rejects.toThrow('host autorizado')
  })

  it('consultarCargo valida idCargo antes de llamar a la API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    await expect(pasarela.consultarCargo('../charges')).rejects.toThrow('inválido')
    await expect(pasarela.consultarCargo('')).rejects.toThrow('inválido')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['charge_pending', 'pendiente'],
    ['IN_PROGRESS', 'pendiente'],
    ['completed', 'aprobado'],
    ['failed', 'rechazado'],
    ['CANCELLED', 'rechazado'],
    ['expired', 'expirado'],
    ['refunded', 'reembolsado'],
    ['chargeback_pending', 'contracargo'],
    ['chargeback_accepted', 'contracargo'],
    ['chargeback_adjustment', 'contracargo'],
  ] as const)('consultarCargo traduce estado %s -> %s y extrae metodoPago seguro', async (estadoApi, esperado) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'tr_123',
            order_id: 'DON-000000000000000000001',
            status: estadoApi,
            amount: 50_000,
            currency: 'COP',
            method: 'card',
            card: { brand: 'Visa', card_number: '411111XXXXXX1111' },
          }),
          { status: 200 },
        ),
      ),
    )

    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)
    const cargo = await pasarela.consultarCargo('tr_123')
    expect(cargo).toEqual({
      idCargo: 'tr_123',
      referencia: 'DON-000000000000000000001',
      estado: esperado,
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'tarjeta · visa · •••• 1111',
    })
    expect(cargo.metodoPago).not.toContain('411111')
  })

  it('consultarCargo ante estado desconocido advierte y lanza error sin mapear a aprobado', async () => {
    const alAdvertir = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'tr_123',
            order_id: 'DON-000000000000000000001',
            status: 'estado_raro',
            amount: 50_000,
            currency: 'COP',
            method: 'card',
          }),
          { status: 200 },
        ),
      ),
    )

    const pasarela = crearPasarelaOpenpay({ ...CONFIG_SANDBOX, alAdvertir })
    await expect(pasarela.consultarCargo('tr_123')).rejects.toThrow('estado desconocido')
    expect(alAdvertir).toHaveBeenCalledWith('Openpay devolvió un estado de cargo desconocido', {
      idCargo: 'tr_123',
      estado: 'estado_raro',
    })
  })

  it('jamás filtra PAN (13-19 dígitos), CVV, llave privada ni Authorization en errores, logs ni metodoPago', async () => {
    const alAdvertir = vi.fn()
    const cuerpoSensible = JSON.stringify({
      error_code: 1001,
      description: 'Rechazo con card_number 4111222233334444 y cvv 789',
      card: { card_number: '4111222233334444', cvv: '789' },
      headers: { Authorization: 'Basic sk_privada_super_secreta' },
      customer: { email: 'ana.munoz@correo.test' },
    })

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(cuerpoSensible, { status: 400 }))
        .mockResolvedValueOnce(new Response(cuerpoSensible, { status: 500 })),
    )

    const pasarela = crearPasarelaOpenpay({ ...CONFIG_SANDBOX, alAdvertir })

    for (const operacion of [() => pasarela.crearCargo(solicitudBase()), () => pasarela.consultarCargo('tr_err_1')]) {
      let errorCapturado: unknown
      try {
        await operacion()
      } catch (error) {
        errorCapturado = error
      }
      expect(errorCapturado).toBeInstanceOf(Error)
      const mensaje = (errorCapturado as Error).message
      expect(mensaje).not.toMatch(/\b\d{13,19}\b/)
      expect(mensaje.toLowerCase()).not.toContain('cvv')
      expect(mensaje).not.toContain('789')
      expect(mensaje).not.toContain('Authorization')
      expect(mensaje).not.toContain('sk_privada_super_secreta')
      expect(mensaje).not.toContain('ana.munoz@correo.test')
    }

    // Si Openpay devuelve un PAN parcial o completo en card_number o un estado desconocido, tampoco se filtra
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'tr_pan_1',
              order_id: 'DON-000000000000000000001',
              status: 'completed',
              amount: 50_000,
              currency: 'COP',
              method: 'card',
              card: { brand: 'MasterCard', card_number: '5412345678904444', cvv: '789' },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'tr_pan_2',
              order_id: 'DON-000000000000000000001',
              status: 'estado_raro',
              description: 'Detalle con 4111222233334444 y cvv 789',
              amount: 50_000,
              currency: 'COP',
              method: 'card',
              card: { brand: 'Visa', card_number: '4111222233334444', cvv: '789' },
              Authorization: 'Basic sk_privada_super_secreta',
            }),
            { status: 200 },
          ),
        ),
    )

    const cargo = await pasarela.consultarCargo('tr_pan_1')
    expect(cargo.metodoPago).toBe('tarjeta · mastercard · •••• 4444')
    expect(cargo.metodoPago).not.toMatch(/\d{13,19}/)
    expect(cargo.metodoPago).not.toContain('541234')

    let errorEstado: unknown
    try {
      await pasarela.consultarCargo('tr_pan_2')
    } catch (error) {
      errorEstado = error
    }
    expect(errorEstado).toBeInstanceOf(Error)
    expect((errorEstado as Error).message).toContain('estado desconocido')
    expect((errorEstado as Error).message).not.toMatch(/\b\d{13,19}\b/)
    expect((errorEstado as Error).message).not.toContain('789')

    const advertencias = JSON.stringify(alAdvertir.mock.calls)
    expect(advertencias).not.toMatch(/\b\d{13,19}\b/)
    expect(advertencias).not.toContain('4111222233334444')
    expect(advertencias.toLowerCase()).not.toContain('cvv')
    expect(advertencias).not.toContain('789')
    expect(advertencias).not.toContain('Authorization')
    expect(advertencias).not.toContain('sk_privada_super_secreta')
  })

  it('consultarCargo con moneda distinta de COP devuelve importe null y la moneda reportada (sin lanzar)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'tr_usd',
            order_id: 'DON-000000000000000000001',
            status: 'completed',
            amount: 12,
            currency: 'USD',
          }),
          { status: 200 },
        ),
      ),
    )
    const cargo = await crearPasarelaOpenpay(CONFIG_SANDBOX).consultarCargo('tr_usd')
    expect(cargo.importe).toBeNull()
    expect(cargo.monedaReportada).toBe('USD')
    expect(cargo.estado).toBe('aprobado')
  })

  it('buscarCargoPorReferencia filtra por order_id en la API y descarta cargos de otra referencia', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 'tr_otro', order_id: 'DON-OTRAOTRAOTRAOTRAOTRAO', status: 'completed', amount: 50_000, currency: 'COP' },
          { id: 'tr_mio', order_id: 'DON-000000000000000000001', status: 'charge_pending', amount: 50_000, currency: 'COP' },
        ]),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const pasarela = crearPasarelaOpenpay(CONFIG_SANDBOX)

    const cargo = await pasarela.buscarCargoPorReferencia('DON-000000000000000000001')
    expect(cargo).toMatchObject({ idCargo: 'tr_mio', estado: 'pendiente', referencia: 'DON-000000000000000000001' })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(
      'https://sandbox-api.openpay.co/v1/m_test_123/charges?order_id=DON-000000000000000000001&offset=0&limit=10',
    )
    expect(init?.method).toBe('GET')

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    expect(await pasarela.buscarCargoPorReferencia('DON-000000000000000000002')).toBeNull()
    await expect(pasarela.buscarCargoPorReferencia('no-es-referencia')).rejects.toThrow('inválida')
  })

  it('listarCargos pagina por fecha de creación y omite (con aviso) estados desconocidos', async () => {
    const alAdvertir = vi.fn()
    const pagina1 = Array.from({ length: 100 }, (_, i) => ({
      id: `tr_${i}`,
      order_id: 'DON-000000000000000000001',
      status: i === 0 ? 'estado_raro' : 'completed',
      amount: 50_000,
      currency: 'COP',
    }))
    const pagina2 = [{ id: 'tr_ultimo', order_id: 'DON-000000000000000000002', status: 'completed', amount: 1, currency: 'COP' }]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pagina1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(pagina2), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const cargos = await crearPasarelaOpenpay({ ...CONFIG_SANDBOX, alAdvertir }).listarCargos({
      desde: new Date('2026-11-16T15:00:00Z'),
      hasta: new Date('2026-11-18T15:00:00Z'),
    })
    expect(cargos).toHaveLength(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      'creation%5Bgte%5D=2026-11-16&creation%5Blte%5D=2026-11-18&offset=100&limit=100',
    )
    expect(alAdvertir).toHaveBeenCalledTimes(1)
  })

  it('consultarCargo de un id que no es ck… va directo a /charges/{id}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'tr_directo',
          order_id: 'DON-000000000000000000001',
          status: 'completed',
          amount: 50_000,
          currency: 'COP',
          method: 'bank_account',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const cargo = await crearPasarelaOpenpay(CONFIG_SANDBOX).consultarCargo('tr_directo')
    expect(cargo).toMatchObject({ idCargo: 'tr_directo', estado: 'aprobado', metodoPago: 'pse', monedaReportada: 'COP' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://sandbox-api.openpay.co/v1/m_test_123/charges/tr_directo')
  })

  it('consultarCargo de un checkout ck… usa /checkouts/{id}, manda el estado de la transacción embebida y toma la referencia del checkout si falta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ck_tx_1',
          order_id: 'DON-000000000000000000001',
          // El checkout puede seguir «available»: lo que confirma el pago es la transacción.
          status: 'available',
          amount: 50_000,
          currency: 'COP',
          transaction: { id: 'tr_emb_1', status: 'completed', amount: 50_000, method: 'store' },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const cargo = await crearPasarelaOpenpay(CONFIG_SANDBOX).consultarCargo('ck_tx_1')
    expect(cargo).toEqual({
      idCargo: 'tr_emb_1',
      referencia: 'DON-000000000000000000001',
      estado: 'aprobado',
      importe: { centavos: 5_000_000n, moneda: 'COP' },
      monedaReportada: 'COP',
      metodoPago: 'efectivo',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://sandbox-api.openpay.co/v1/m_test_123/checkouts/ck_tx_1')
  })

  it('checkout con transacción de tarjeta sin detalle: amplía con /charges/{tx} solo con marca y últimos 4', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ck_card_1',
            order_id: 'DON-000000000000000000001',
            status: 'completed',
            amount: 50_000,
            currency: 'COP',
            transaction: { id: 'tr_card_1', status: 'completed', amount: 50_000, method: 'card' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'tr_card_1',
            order_id: 'DON-000000000000000000001',
            status: 'completed',
            amount: 50_000,
            currency: 'COP',
            method: 'card',
            card: { brand: 'Visa', card_number: '4111111111111111', cvv2: '123' },
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const cargo = await crearPasarelaOpenpay(CONFIG_SANDBOX).consultarCargo('ck_card_1')
    expect(cargo.metodoPago).toBe('tarjeta · visa · •••• 1111')
    expect(JSON.stringify(cargo, (_, v) => (typeof v === 'bigint' ? String(v) : v))).not.toMatch(/411111|123/)
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://sandbox-api.openpay.co/v1/m_test_123/charges/tr_card_1')
  })

  it('un checkout SIN transacción nunca aprueba: «completed» se trata como pendiente y se avisa', async () => {
    const alAdvertir = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'ck_sin_tx',
            order_id: 'DON-000000000000000000001',
            status: 'completed',
            amount: 50_000,
            currency: 'COP',
          }),
          { status: 200 },
        ),
      ),
    )

    const cargo = await crearPasarelaOpenpay({ ...CONFIG_SANDBOX, alAdvertir }).consultarCargo('ck_sin_tx')
    expect(cargo.estado).toBe('pendiente')
    expect(alAdvertir).toHaveBeenCalledWith(expect.stringContaining('sin transacción'), {
      idCargo: 'ck_sin_tx',
      estado: 'aprobado',
    })
  })

  it('checkout con moneda distinta de COP devuelve importe null y la moneda reportada (discrepancia, sin lanzar)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'ck_usd',
            order_id: 'DON-000000000000000000001',
            status: 'available',
            amount: 12,
            currency: 'USD',
            transaction: { id: 'tr_usd_1', status: 'completed', amount: 12, method: 'bank_account' },
          }),
          { status: 200 },
        ),
      ),
    )

    const cargo = await crearPasarelaOpenpay(CONFIG_SANDBOX).consultarCargo('ck_usd')
    expect(cargo).toMatchObject({ idCargo: 'tr_usd_1', estado: 'aprobado', importe: null, monedaReportada: 'USD' })
  })

  it('una transacción sin moneda (ni en ella ni en su checkout) queda con importe null en el listado', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify([{ id: 'tr_sin_moneda', order_id: 'DON-000000000000000000001', status: 'completed', amount: 50_000 }]),
            { status: 200 },
          ),
        ),
    )

    const cargos = await crearPasarelaOpenpay(CONFIG_SANDBOX).listarCargos({
      desde: new Date('2026-11-16T15:00:00Z'),
      hasta: new Date('2026-11-16T15:00:00Z'),
    })
    expect(cargos).toEqual([expect.objectContaining({ idCargo: 'tr_sin_moneda', importe: null, monedaReportada: '' })])
  })
})
