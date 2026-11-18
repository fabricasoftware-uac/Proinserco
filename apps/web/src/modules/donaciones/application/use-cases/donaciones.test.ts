import { describe, expect, it, vi } from 'vitest'
import '@/shared/lib/zod-sin-eval'
import { Actor } from '@/shared/domain/actor'
import { NoAutorizado, NoEncontrado } from '@/shared/domain/errores'
import { importeDesdePesos } from '@/shared/domain/importe'
import { AHORA, actorDe, crearMundoMemoria, solicitudDonacion } from '@/test/mundo-memoria'
import {
  CargoRechazadoPorFraude,
  DonacionesDeshabilitadas,
  DonacionYaProcesada,
  MontoFueraDeRango,
  PasarelaNoDisponible,
} from '../../domain/errores'
import { FiltrosDonaciones } from '../../domain/esquemas'
import { crearCrearDonacion } from './crear-donacion'

function idCargoDe(urlPago: string) {
  const id = new URL(urlPago).searchParams.get('cargo')
  if (!id) throw new Error('sin cargo')
  return id
}

describe('crear donación', () => {
  it('crea la donación pendiente y devuelve la URL de la pasarela', async () => {
    const m = crearMundoMemoria()
    const r = await m.crearDonacion(solicitudDonacion(50_000))
    expect(r.urlPago).toMatch(/^https:\/\/proinserco\.test\/donar\/pasarela-simulada\?cargo=sim_/)
    const d = await m.repoDonaciones.buscarPorReferencia(r.referencia)
    expect(d?.estado).toBe('pendiente')
    expect(d?.datos.importe).toEqual({ centavos: 5_000_000n, moneda: 'COP' })
    expect(d?.datos.pagador.correo).toBe('ana.munoz@correo-demo.test')
  })

  it('registra al donante con una autorización por finalidad', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const pagina = await m.listarDonantes({}, {}, actorDe('administrador'))
    const donante = pagina.elementos[0]
    expect(donante?.celular).toBe('+573001234567')
    expect(donante?.numeroDocumento).toBe('1061000111')
    const finalidades = (await m.consentimientos.listarPorDonante(donante?.id ?? '')).map((c) => c.finalidad)
    expect(finalidades).toEqual(['gestion_donacion', 'certificado_donacion'])
  })

  it('un precio manipulado (por debajo del mínimo) no crea nada', async () => {
    const m = crearMundoMemoria()
    await expect(m.crearDonacion(solicitudDonacion(1))).rejects.toThrow(MontoFueraDeRango)
    expect((await m.listarDonaciones({}, {}, actorDe('administrador'))).total).toBe(0)
  })

  it('es idempotente: la misma clave devuelve el mismo cargo', async () => {
    const m = crearMundoMemoria()
    const clave = '22222222-2222-4222-8222-222222222222'
    const a = await m.crearDonacion(solicitudDonacion(50_000, clave))
    const b = await m.crearDonacion(solicitudDonacion(50_000, clave))
    expect(b).toEqual(a)
    expect((await m.listarDonaciones({}, {}, actorDe('administrador'))).total).toBe(1)
  })

  it('la misma clave tras resolverse el pago no admite reintento', async () => {
    const m = crearMundoMemoria()
    const clave = '33333333-3333-4333-8333-333333333333'
    const { urlPago } = await m.crearDonacion(solicitudDonacion(50_000, clave))
    m.pasarela.resolverCargo(idCargoDe(urlPago), 'rechazado')
    await m.conciliarDonacion({ idCargo: idCargoDe(urlPago) })
    await expect(m.crearDonacion(solicitudDonacion(50_000, clave))).rejects.toThrow(DonacionYaProcesada)
  })

  it('el interruptor de emergencia impide crear cargos', async () => {
    const m = crearMundoMemoria({ habilitadas: false })
    await expect(m.crearDonacion(solicitudDonacion())).rejects.toThrow(DonacionesDeshabilitadas)
  })

  it('sin autorización de datos válida no se procesa (datos del donante inválidos)', async () => {
    const m = crearMundoMemoria()
    const s = { ...solicitudDonacion(), donante: { ...solicitudDonacion().donante, correo: 'no-es-correo' } }
    await expect(m.crearDonacion(s)).rejects.toThrow()
  })

  it('deja pasar CargoRechazadoPorFraude sin envolverlo en PasarelaNoDisponible y envuelve fallos internos', async () => {
    const m = crearMundoMemoria()
    const crearCargo = vi
      .fn()
      .mockRejectedValueOnce(new CargoRechazadoPorFraude())
      .mockRejectedValueOnce(new Error('500 interno'))
    const crearConPasarela = crearCrearDonacion({
      donaciones: m.repoDonaciones,
      pasarela: { crearCargo, consultarCargo: vi.fn() },
      donantes: {
        registrar: async () => ({
          donanteId: '00000000-0000-4000-8000-000000000001',
          nombres: 'Ana María',
          apellidos: 'Muñoz Ortega',
          correo: 'ana.munoz@correo-demo.test',
        }),
      },
      reloj: m.reloj,
      ids: { uuid: () => crypto.randomUUID(), referencia: () => `DON-${'A'.repeat(21)}` },
      eventos: m.eventos,
      auditor: { registrar: m.registrarAuditoria },
      configuracion: {
        limites: { minimoPesos: 10_000, maximoPesos: 20_000_000 },
        habilitadas: true,
        urlBase: 'https://proinserco.test',
      },
    })

    await expect(crearConPasarela(solicitudDonacion(50_000))).rejects.toThrow(CargoRechazadoPorFraude)
    await expect(
      crearCrearDonacion({
        donaciones: m.repoDonaciones,
        pasarela: { crearCargo, consultarCargo: vi.fn() },
        donantes: {
          registrar: async () => ({
            donanteId: '00000000-0000-4000-8000-000000000001',
            nombres: 'Ana María',
            apellidos: 'Muñoz Ortega',
            correo: 'ana.munoz@correo-demo.test',
          }),
        },
        reloj: m.reloj,
        ids: { uuid: () => crypto.randomUUID(), referencia: () => `DON-${'B'.repeat(21)}` },
        eventos: m.eventos,
        auditor: { registrar: m.registrarAuditoria },
        configuracion: {
          limites: { minimoPesos: 10_000, maximoPesos: 20_000_000 },
          habilitadas: true,
          urlBase: 'https://proinserco.test',
        },
      })(solicitudDonacion(50_000)),
    ).rejects.toThrow(PasarelaNoDisponible)
  })
})

describe('confirmar / rechazar (conciliación con la pasarela)', () => {
  it('aprueba solo cuando la pasarela lo confirma, y es idempotente', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion())
    m.pasarela.resolverCargo(idCargoDe(urlPago), 'aprobado')
    expect(await m.conciliarDonacion({ referencia }, 'webhook')).toEqual({ resultado: 'actualizada', estado: 'aprobada' })
    expect(await m.conciliarDonacion({ referencia }, 'webhook')).toEqual({ resultado: 'sin_cambios', estado: 'aprobada' })
    expect(m.eventos.publicados.map((e) => e.tipo)).toContain('donacion.aprobada')
  })

  it('un webhook falso (la pasarela sigue pendiente) no aprueba nada', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion())
    const r = await m.conciliarDonacion({ idCargo: idCargoDe(urlPago) }, 'webhook')
    expect(r).toEqual({ resultado: 'sin_cambios', estado: 'pendiente' })
    expect((await m.repoDonaciones.buscarPorReferencia(referencia))?.estado).toBe('pendiente')
  })

  it('rechaza cuando la pasarela rechaza, y no permite volver a aprobada', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion())
    m.pasarela.resolverCargo(idCargoDe(urlPago), 'rechazado')
    expect(await m.conciliarDonacion({ referencia })).toMatchObject({ estado: 'rechazada' })
    m.pasarela.forzarEstado(idCargoDe(urlPago), 'aprobado')
    const r = await m.conciliarDonacion({ referencia })
    expect(r).toMatchObject({ resultado: 'transicion_invalida', estado: 'rechazada' })
  })

  it('no aprueba si el importe de la pasarela no coincide', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion(50_000))
    m.pasarela.forzarEstado(idCargoDe(urlPago), 'aprobado', importeDesdePesos(500))
    expect(await m.conciliarDonacion({ referencia })).toEqual({ resultado: 'discrepancia', estado: 'pendiente' })
    const auditoria = await m.listarAuditoria({ accion: 'donacion.discrepancia' }, {}, actorDe('administrador'))
    expect(auditoria.total).toBe(1)
  })

  it('aplica contracargo después de aprobada', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion())
    m.pasarela.resolverCargo(idCargoDe(urlPago), 'aprobado')
    await m.conciliarDonacion({ referencia })
    m.pasarela.forzarEstado(idCargoDe(urlPago), 'contracargo')
    expect(await m.conciliarDonacion({ referencia })).toMatchObject({ estado: 'contracargo' })
  })

  it('la página de resultado lee el estado del servidor y concilia si sigue pendiente', async () => {
    const m = crearMundoMemoria()
    const { referencia, urlPago } = await m.crearDonacion(solicitudDonacion(80_000))
    expect(await m.consultarResultado(referencia)).toEqual({
      estado: 'pendiente',
      montoPesos: 80_000,
      referencia,
      fecha: expect.any(Date),
      quiereCertificado: expect.any(Boolean),
    })
    m.pasarela.resolverCargo(idCargoDe(urlPago), 'aprobado')
    expect((await m.consultarResultado(referencia)).estado).toBe('aprobada')
  })

  it('una referencia inventada o mal formada responde no encontrado', async () => {
    const m = crearMundoMemoria()
    await expect(m.consultarResultado('DON-AAAAAAAAAAAAAAAAAAAAA')).rejects.toThrow(NoEncontrado)
    await expect(m.consultarResultado('<script>')).rejects.toThrow(NoEncontrado)
  })
})

describe('consultas del panel', () => {
  it('lista con filtros y pagina por cursor sin repetir elementos', async () => {
    const m = crearMundoMemoria()
    for (let i = 0; i < 5; i++) {
      await m.crearDonacion(solicitudDonacion(10_000 * (i + 1)))
      m.reloj.avanzar(60_000)
    }
    const admin = actorDe('administrador')
    const p1 = await m.listarDonaciones({ estado: 'pendiente' }, { limite: 2 }, admin)
    expect(p1.elementos).toHaveLength(2)
    expect(p1.total).toBe(5)
    const p2 = await m.listarDonaciones({ estado: 'pendiente' }, { limite: 2, cursor: p1.cursorSiguiente ?? undefined }, admin)
    const p3 = await m.listarDonaciones({ estado: 'pendiente' }, { limite: 2, cursor: p2.cursorSiguiente ?? undefined }, admin)
    const ids = [...p1.elementos, ...p2.elementos, ...p3.elementos].map((d) => d.id)
    expect(new Set(ids).size).toBe(5)
    expect(p3.cursorSiguiente).toBeNull()
    expect((await m.listarDonaciones({ estado: 'aprobada' }, {}, admin)).total).toBe(0)
  })

  it('un cursor manipulado no rompe: empieza desde el principio', async () => {
    const m = crearMundoMemoria()
    await m.crearDonacion(solicitudDonacion())
    const p = await m.listarDonaciones({}, { cursor: 'basura!!' }, actorDe('administrador'))
    expect(p.elementos).toHaveLength(1)
  })

  it('el detalle exige permiso y responde no encontrado si no existe', async () => {
    const m = crearMundoMemoria()
    const { referencia } = await m.crearDonacion(solicitudDonacion())
    const d = await m.repoDonaciones.buscarPorReferencia(referencia)
    const sinPermiso = new Actor('x', 'x', 'x@x.test', 'ninguno', [], 'aal2')
    await expect(m.obtenerDonacion(d?.id ?? '', sinPermiso)).rejects.toThrow(NoAutorizado)
    await expect(m.obtenerDonacion('no-existe', actorDe('consulta'))).rejects.toThrow(NoEncontrado)
  })

  it('calcula los indicadores del resumen', async () => {
    const m = crearMundoMemoria()
    const a = await m.crearDonacion(solicitudDonacion(50_000))
    const b = await m.crearDonacion(solicitudDonacion(100_000))
    await m.crearDonacion(solicitudDonacion(20_000))
    m.pasarela.resolverCargo(idCargoDe(a.urlPago), 'aprobado')
    m.pasarela.resolverCargo(idCargoDe(b.urlPago), 'rechazado')
    await m.conciliarDonacion({ referencia: a.referencia })
    await m.conciliarDonacion({ referencia: b.referencia })
    const ind = await m.obtenerIndicadores(actorDe('consulta'), 7)
    expect(ind).toMatchObject({ recaudadoPesos: 50_000, aprobadas: 1, pendientes: 1, rechazadas: 1, tasaAprobacion: 0.5 })
    expect(ind.serie).toHaveLength(7)
    expect(ind.serie.at(-1)).toEqual({ fecha: AHORA.toISOString().slice(0, 10), montoPesos: 50_000, cantidad: 1 })
  })

  it('valida FiltrosDonaciones con jitless activo para bigint, enteros y criterios de orden', () => {
    expect(FiltrosDonaciones.parse({})).toEqual({})
    expect(FiltrosDonaciones.parse({ minCentavos: 2_500_000n, maxCentavos: 10_000_000, orden: 'monto', dir: 'asc' })).toEqual({
      minCentavos: 2_500_000n,
      maxCentavos: 10_000_000n,
      orden: 'monto',
      dir: 'asc',
    })
    expect(FiltrosDonaciones.parse({ minCentavos: -10, maxCentavos: 'abc', orden: 'otra', dir: 'lado' })).toEqual({
      minCentavos: undefined,
      maxCentavos: undefined,
      orden: undefined,
      dir: undefined,
    })
  })

  it('filtra por monto en centavos y ordena/pagina nativamente por fecha, monto y estado', async () => {
    const m = crearMundoMemoria()
    const admin = actorDe('administrador')
    const d1 = await m.crearDonacion(solicitudDonacion(30_000))
    m.reloj.avanzar(60_000)
    const d2 = await m.crearDonacion(solicitudDonacion(10_000))
    m.reloj.avanzar(60_000)
    const d3 = await m.crearDonacion(solicitudDonacion(50_000))
    m.reloj.avanzar(60_000)
    const d4 = await m.crearDonacion(solicitudDonacion(50_000))

    m.pasarela.resolverCargo(idCargoDe(d2.urlPago), 'aprobado')
    m.pasarela.resolverCargo(idCargoDe(d4.urlPago), 'rechazado')
    await m.conciliarDonacion({ referencia: d2.referencia })
    await m.conciliarDonacion({ referencia: d4.referencia })

    const rango = await m.listarDonaciones({ minCentavos: 3_000_000n, maxCentavos: 5_000_000n }, {}, admin)
    expect(rango.total).toBe(3)
    expect(rango.elementos.every((d) => d.datos.importe.centavos >= 3_000_000n && d.datos.importe.centavos <= 5_000_000n)).toBe(
      true,
    )

    const p1Monto = await m.listarDonaciones({ orden: 'monto', dir: 'asc' }, { limite: 2 }, admin)
    expect(p1Monto.elementos.map((d) => Number(d.datos.importe.centavos / 100n))).toEqual([10_000, 30_000])
    const p2Monto = await m.listarDonaciones(
      { orden: 'monto', dir: 'asc' },
      { limite: 2, cursor: p1Monto.cursorSiguiente ?? undefined },
      admin,
    )
    expect(p2Monto.elementos.map((d) => Number(d.datos.importe.centavos / 100n))).toEqual([50_000, 50_000])
    expect(p2Monto.elementos[0]?.id).not.toBe(p2Monto.elementos[1]?.id)
    expect(p2Monto.elementos.every((d) => d.datos.referencia === d3.referencia || d.datos.referencia === d4.referencia)).toBe(
      true,
    )
    expect(p2Monto.cursorSiguiente).toBeNull()

    // Si cambia el orden manteniendo el cursor previo, reinicia desde el principio sin fallar.
    const porEstado = await m.listarDonaciones(
      { orden: 'estado', dir: 'asc' },
      { limite: 4, cursor: p1Monto.cursorSiguiente ?? undefined },
      admin,
    )
    expect(porEstado.elementos.map((d) => d.estado)).toEqual(['aprobada', 'pendiente', 'pendiente', 'rechazada'])
    expect(d1.referencia).toBeTruthy()
  })
})
