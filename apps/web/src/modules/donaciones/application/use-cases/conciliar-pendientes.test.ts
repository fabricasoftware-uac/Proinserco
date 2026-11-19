import { describe, expect, it, vi } from 'vitest'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import type { Auditor } from '@/shared/application/ports/auditor'
import type { Alerta, Notificador } from '@/shared/application/ports/notificador'
import { importeDesdePesos } from '@/shared/domain/importe'
import { crearPublicadorEventosMemoria } from '@/shared/infrastructure/publicador-eventos-memoria'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import { crearIdsSecuenciales } from '@/test/mundo-memoria'
import { Donacion, type DonacionId } from '../../domain/donacion'
import { crearRepositorioDonacionesMemoria } from '../../infrastructure/repositorio-donaciones-memoria'
import type { CargoConsultado, PasarelaPagos } from '../ports/pasarela-pagos'
import { crearConciliarDonacion } from './conciliar-donacion'
import { crearConciliarPendientes } from './conciliar-pendientes'

const BASE = new Date('2026-11-16T15:00:00.000Z')
const MINUTO = 60_000

type ConsultaCargo = (idCargo: string) => Promise<Omit<CargoConsultado, 'monedaReportada'>>

/** Pasarela de prueba: lo no indicado no existe (sin cargo por referencia, listado vacío). */
function pasarelaPrueba(
  p: {
    consultarCargo?: ConsultaCargo
    buscarCargoPorReferencia?: PasarelaPagos['buscarCargoPorReferencia']
    listarCargos?: PasarelaPagos['listarCargos']
  } = {},
): PasarelaPagos {
  const consultar =
    p.consultarCargo ??
    (async () => {
      throw new Error('consultarCargo no esperado')
    })
  return {
    crearCargo: vi.fn(),
    consultarCargo: async (id) => ({ monedaReportada: 'COP', ...(await consultar(id)) }),
    buscarCargoPorReferencia: p.buscarCargoPorReferencia ?? (async () => null),
    listarCargos: p.listarCargos ?? (async () => []),
  }
}

function crearNotificadorPrueba(): Notificador & { alertas: Alerta[] } {
  const alertas: Alerta[] = []
  return { alertas, notificar: async (a) => void alertas.push(a) }
}

function crearEntorno(pasarela: PasarelaPagos) {
  const reloj = crearRelojFijo(BASE)
  const ids = crearIdsSecuenciales()
  const eventos = crearPublicadorEventosMemoria()
  const registroAuditoria = crearRegistroAuditoriaMemoria()
  const auditor: Auditor = { registrar: crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids }) }
  const donaciones = crearRepositorioDonacionesMemoria(reloj)
  const notificador = crearNotificadorPrueba()
  const conciliar = crearConciliarDonacion({ donaciones, pasarela, reloj, eventos, auditor })
  const conciliarPendientes = crearConciliarPendientes({ donaciones, conciliar, pasarela, reloj, auditor, notificador })
  return { reloj, ids, donaciones, registroAuditoria, conciliarPendientes, alertas: notificador.alertas }
}

function construirDonacion(ids: ReturnType<typeof crearIdsSecuenciales>, creadaEn: Date, montoPesos = 50_000): Donacion {
  return Donacion.crear(
    {
      id: ids.uuid() as DonacionId,
      referencia: ids.referencia(),
      claveIdempotencia: ids.uuid(),
      importe: importeDesdePesos(montoPesos),
      linea: 'educacion',
      donanteId: '00000000-0000-4000-8000-000000000999',
      pagador: { nombres: 'Ana', apellidos: 'Muñoz', correo: 'ana@demo.test' },
      quiereCertificado: false,
    },
    creadaEn,
  )
}

describe('conciliarPendientes', () => {
  it('expira creadas sin cargo > 60 min, respeta recientes y concilia creadas con cargo y pendientes > 15 min', async () => {
    const consultarCargo = vi.fn(async (idCargo: string) => {
      if (idCargo === 'chg_creada_con_cargo') {
        return {
          idCargo,
          referencia: refCreadaConCargo,
          estado: 'pendiente' as const,
          importe: importeDesdePesos(50_000),
          metodoPago: null,
        }
      }
      return {
        idCargo,
        referencia: refPendienteVieja,
        estado: 'aprobado' as const,
        importe: importeDesdePesos(50_000),
        metodoPago: 'tarjeta · visa · •••• 1111',
      }
    })
    const env = crearEntorno(pasarelaPrueba({ consultarCargo }))

    // 1. Creada sin cargo de hace 65 min -> expira
    const creadaAbandonada = construirDonacion(env.ids, new Date(BASE.getTime() - 65 * MINUTO))
    // 2. Creada sin cargo de hace 40 min -> no expira todavía
    const creadaReciente = construirDonacion(env.ids, new Date(BASE.getTime() - 40 * MINUTO))
    // 3. Creada con cargo de hace 20 min -> se concilia una sola vez
    const creadaConCargoBase = construirDonacion(env.ids, new Date(BASE.getTime() - 20 * MINUTO))
    const refCreadaConCargo = creadaConCargoBase.datos.referencia
    const creadaConCargo = Donacion.reconstruir({
      ...creadaConCargoBase.datos,
      idCargo: 'chg_creada_con_cargo',
    })
    // 4. Pendiente de hace 25 min -> se concilia y pasa a aprobada
    const pendienteVieja = construirDonacion(env.ids, new Date(BASE.getTime() - 25 * MINUTO)).registrarCargo(
      'chg_pendiente_vieja',
      'https://sandbox-api.openpay.co/pay/1',
      new Date(BASE.getTime() - 25 * MINUTO),
    )
    const refPendienteVieja = pendienteVieja.datos.referencia
    // 5. Pendiente de hace 10 min -> dentro de ventana de gracia, no se consulta
    const pendienteReciente = construirDonacion(env.ids, new Date(BASE.getTime() - 10 * MINUTO)).registrarCargo(
      'chg_pendiente_reciente',
      'https://sandbox-api.openpay.co/pay/2',
      new Date(BASE.getTime() - 10 * MINUTO),
    )

    for (const d of [creadaAbandonada, creadaReciente, creadaConCargo, pendienteVieja, pendienteReciente]) {
      await env.donaciones.insertar(d)
    }

    const resumen = await env.conciliarPendientes()
    expect(resumen).toEqual({
      revisadas: 3,
      actualizadas: 2,
      expiradas: 1,
      discrepancias: 0,
      errores: 0,
      cargosCruzados: 0,
    })
    expect(env.alertas).toHaveLength(0)
    expect(consultarCargo).toHaveBeenCalledTimes(2)

    expect((await env.donaciones.buscarPorId(creadaAbandonada.id))?.estado).toBe('expirada')
    expect((await env.donaciones.buscarPorId(creadaReciente.id))?.estado).toBe('creada')
    expect((await env.donaciones.buscarPorId(creadaConCargo.id))?.estado).toBe('pendiente')
    expect((await env.donaciones.buscarPorId(pendienteVieja.id))?.estado).toBe('aprobada')
    expect((await env.donaciones.buscarPorId(pendienteReciente.id))?.estado).toBe('pendiente')

    const auditoria = await env.registroAuditoria.listar({ accion: 'donacion.transicion' }, { limite: 10 })
    expect(auditoria.elementos.some((a) => a.recursoId === creadaAbandonada.id && a.detalles.hacia === 'expirada')).toBe(true)
  })

  it('pagina por cursor más allá de 100 elementos y alerta ante discrepancias y errores', async () => {
    const refsPorCargo = new Map<string, string>()
    const consultarCargo = vi.fn(async (idCargo: string) => {
      if (idCargo === 'chg_error') throw new Error('Timeout Openpay')
      if (idCargo === 'chg_discrepancia') {
        return {
          idCargo,
          referencia: refsPorCargo.get(idCargo) ?? '',
          estado: 'aprobado' as const,
          importe: importeDesdePesos(100),
          metodoPago: null,
        }
      }
      return {
        idCargo,
        referencia: refsPorCargo.get(idCargo) ?? '',
        estado: 'aprobado' as const,
        importe: importeDesdePesos(50_000),
        metodoPago: 'tarjeta',
      }
    })
    const env = crearEntorno(pasarelaPrueba({ consultarCargo }))

    const tViejo = new Date(BASE.getTime() - 120 * MINUTO)
    for (let i = 0; i < 105; i++) {
      const idCargo = i === 0 ? 'chg_error' : i === 1 ? 'chg_discrepancia' : `chg_ok_${i}`
      const fecha = new Date(tViejo.getTime() + i * 1_000)
      const d = construirDonacion(env.ids, fecha).registrarCargo(idCargo, `https://sandbox-api.openpay.co/pay/${i}`, fecha)
      refsPorCargo.set(idCargo, d.datos.referencia)
      await env.donaciones.insertar(d)
    }

    const resumen = await env.conciliarPendientes()
    expect(resumen).toEqual({
      revisadas: 105,
      actualizadas: 103,
      expiradas: 0,
      discrepancias: 1,
      errores: 1,
      cargosCruzados: 0,
    })
    expect(env.alertas).toHaveLength(1)
    expect(env.alertas[0]).toMatchObject({ severidad: 'critica', detalles: { ...resumen, auditada: true } })
    const alerta = await env.registroAuditoria.listar({ accion: 'conciliacion.alerta' }, { limite: 5 })
    expect(alerta.elementos).toHaveLength(1)
    expect(alerta.elementos[0]?.detalles).toMatchObject({ severidad: 'critica', discrepancias: 1, errores: 1 })
  })

  it('si una donación creada sin idCargo > 60 min pierde la carrera al expirar, no falla ni incrementa expiradas', async () => {
    const reloj = crearRelojFijo(BASE)
    const ids = crearIdsSecuenciales()
    const eventos = crearPublicadorEventosMemoria()
    const registroAuditoria = crearRegistroAuditoriaMemoria()
    const auditor: Auditor = { registrar: crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids }) }
    const repoBase = crearRepositorioDonacionesMemoria(reloj)

    const creadaAbandonada = construirDonacion(ids, new Date(BASE.getTime() - 65 * MINUTO))
    await repoBase.insertar(creadaAbandonada)

    // Simula otro proceso ganando la carrera justo antes de `actualizarSiEstado` al expirar
    const repoConCarrera = {
      ...repoBase,
      async actualizarSiEstado(donacion: Donacion, estadoEsperado: Donacion['estado']) {
        if (donacion.id === creadaAbandonada.id && estadoEsperado === 'creada') {
          const ganadora = creadaAbandonada.registrarCargo('chg_carrera_1', 'https://sandbox-api.openpay.co/pay/carrera', BASE)
          await repoBase.actualizarSiEstado(ganadora, 'creada')
        }
        return repoBase.actualizarSiEstado(donacion, estadoEsperado)
      },
    }

    const pasarela = pasarelaPrueba()
    const conciliar = crearConciliarDonacion({ donaciones: repoConCarrera, pasarela, reloj, eventos, auditor })
    const notificador = crearNotificadorPrueba()
    const conciliarPendientes = crearConciliarPendientes({
      donaciones: repoConCarrera,
      conciliar,
      pasarela,
      reloj,
      auditor,
      notificador,
    })

    const resumen = await conciliarPendientes()
    expect(resumen).toEqual({
      revisadas: 1,
      actualizadas: 0,
      expiradas: 0,
      discrepancias: 0,
      errores: 0,
      cargosCruzados: 0,
    })
    expect(notificador.alertas).toHaveLength(0)
    expect((await repoBase.buscarPorId(creadaAbandonada.id))?.estado).toBe('pendiente')

    const auditoriaExpirada = await registroAuditoria.listar({ accion: 'donacion.transicion' }, { limite: 10 })
    expect(auditoriaExpirada.elementos.some((a) => a.detalles.hacia === 'expirada')).toBe(false)
  })

  it('donación creada CON idCargo > 15 min aprobada en Openpay recorre creada -> pendiente -> aprobada y actualiza', async () => {
    let referenciaEsperada = ''
    const consultarCargo = vi.fn(async (idCargo: string) => ({
      idCargo,
      referencia: referenciaEsperada,
      estado: 'aprobado' as const,
      importe: importeDesdePesos(50_000),
      metodoPago: 'tarjeta · visa · •••• 4242',
    }))
    const env = crearEntorno(pasarelaPrueba({ consultarCargo }))

    const base = construirDonacion(env.ids, new Date(BASE.getTime() - 20 * MINUTO))
    referenciaEsperada = base.datos.referencia
    const creadaConCargo = Donacion.reconstruir({
      ...base.datos,
      idCargo: 'chg_creada_aprobada',
    })
    await env.donaciones.insertar(creadaConCargo)

    const resumen = await env.conciliarPendientes()
    expect(resumen).toEqual({
      revisadas: 1,
      actualizadas: 1,
      expiradas: 0,
      discrepancias: 0,
      errores: 0,
      cargosCruzados: 0,
    })
    expect(env.alertas).toHaveLength(0)
    expect(consultarCargo).toHaveBeenCalledTimes(1)

    const final = await env.donaciones.buscarPorId(creadaConCargo.id)
    expect(final?.estado).toBe('aprobada')
    expect(final?.datos.metodoPago).toBe('tarjeta · visa · •••• 4242')
    expect(final?.datos.historial).toEqual([
      { desde: 'creada', hacia: 'pendiente', en: BASE, origen: 'conciliacion' },
      { desde: 'pendiente', hacia: 'aprobada', en: BASE, origen: 'conciliacion' },
    ])

    const auditoria = await env.registroAuditoria.listar({ recursoId: creadaConCargo.id }, { limite: 10 })
    expect(auditoria.elementos.map((e) => [e.detalles.desde, e.detalles.hacia])).toEqual([
      ['pendiente', 'aprobada'],
      ['creada', 'pendiente'],
    ])
  })

  it('creada SIN idCargo abandonada: si Openpay tiene el cargo por order_id aplica su estado real y NO la expira', async () => {
    let referencia = ''
    const buscarCargoPorReferencia = vi.fn(async (ref: string) =>
      ref === referencia
        ? {
            idCargo: 'chg_recuperado',
            referencia,
            estado: 'aprobado' as const,
            importe: importeDesdePesos(50_000),
            monedaReportada: 'COP',
            metodoPago: 'tarjeta',
          }
        : null,
    )
    const env = crearEntorno(pasarelaPrueba({ buscarCargoPorReferencia }))
    const huerfana = construirDonacion(env.ids, new Date(BASE.getTime() - 90 * MINUTO))
    referencia = huerfana.datos.referencia
    await env.donaciones.insertar(huerfana)

    const resumen = await env.conciliarPendientes()

    expect(resumen).toMatchObject({ revisadas: 1, actualizadas: 1, expiradas: 0, errores: 0 })
    expect(buscarCargoPorReferencia).toHaveBeenCalledWith(referencia)
    const final = await env.donaciones.buscarPorId(huerfana.id)
    expect(final?.estado).toBe('aprobada')
    expect(final?.datos.idCargo).toBe('chg_recuperado')
  })

  it('creada SIN idCargo abandonada: si Openpay no responde NO se expira (se reintenta en la próxima corrida)', async () => {
    const env = crearEntorno(
      pasarelaPrueba({
        buscarCargoPorReferencia: async () => {
          throw new Error('Openpay caído')
        },
      }),
    )
    const huerfana = construirDonacion(env.ids, new Date(BASE.getTime() - 90 * MINUTO))
    await env.donaciones.insertar(huerfana)

    const resumen = await env.conciliarPendientes()

    expect(resumen).toMatchObject({ expiradas: 0, errores: 1 })
    expect((await env.donaciones.buscarPorId(huerfana.id))?.estado).toBe('creada')
    expect(env.alertas[0]?.severidad).toBe('advertencia')
  })

  it('cruce diario: cargo aprobado en Openpay sin reflejo local queda como discrepancia auditada y alerta crítica', async () => {
    const aprobado = (idCargo: string, referencia: string): CargoConsultado => ({
      idCargo,
      referencia,
      estado: 'aprobado',
      importe: importeDesdePesos(50_000),
      monedaReportada: 'COP',
      metodoPago: 'tarjeta',
    })
    const cargos: CargoConsultado[] = []
    const env = crearEntorno(
      pasarelaPrueba({
        listarCargos: async () => cargos,
        consultarCargo: async (id) => {
          const c = cargos.find((x) => x.idCargo === id)
          if (!c) throw new Error('no existe')
          return c
        },
      }),
    )

    // a) Pendiente reciente (dentro de la gracia) que Openpay ya aprobó → se concilia en el cruce.
    const pendiente = construirDonacion(env.ids, new Date(BASE.getTime() - 5 * MINUTO)).registrarCargo(
      'chg_pend',
      'https://sandbox-api.openpay.co/pay/p',
      BASE,
    )
    // b) Rechazada aquí pero aprobada en Openpay → no se corrige: discrepancia.
    const rechazadaBase = construirDonacion(env.ids, new Date(BASE.getTime() - 5 * MINUTO)).registrarCargo(
      'chg_rech',
      'https://sandbox-api.openpay.co/pay/r',
      BASE,
    )
    const rechazada = rechazadaBase.transicionar('rechazada', BASE, 'webhook')
    // c) Ya aprobada → nada que hacer.
    const yaAprobada = construirDonacion(env.ids, new Date(BASE.getTime() - 5 * MINUTO))
      .registrarCargo('chg_ok', 'https://sandbox-api.openpay.co/pay/o', BASE)
      .transicionar('aprobada', BASE, 'webhook')
    for (const d of [pendiente, rechazada, yaAprobada]) await env.donaciones.insertar(d)

    cargos.push(
      aprobado('chg_pend', pendiente.datos.referencia),
      aprobado('chg_rech', rechazada.datos.referencia),
      aprobado('chg_ok', yaAprobada.datos.referencia),
      aprobado('chg_huerfano', 'DON-ZZZZZZZZZZZZZZZZZZZZZ'), // d) sin donación local
      { ...aprobado('chg_pend_op', 'x'), estado: 'pendiente' }, // los no aprobados no se cruzan
    )

    const resumen = await env.conciliarPendientes()

    expect(resumen).toMatchObject({ cargosCruzados: 4, actualizadas: 1, discrepancias: 2, errores: 0 })
    expect((await env.donaciones.buscarPorId(pendiente.id))?.estado).toBe('aprobada')
    expect((await env.donaciones.buscarPorId(rechazada.id))?.estado).toBe('rechazada')

    const discrepancias = await env.registroAuditoria.listar({ accion: 'donacion.discrepancia' }, { limite: 10 })
    const motivos = discrepancias.elementos.map((e) => e.detalles.motivo).sort()
    expect(motivos).toEqual(['aprobado_no_reflejado', 'aprobado_sin_donacion'])
    expect(discrepancias.elementos.every((e) => e.detalles.severidad === 'alta')).toBe(true)

    expect(env.alertas).toHaveLength(1)
    expect(env.alertas[0]?.severidad).toBe('critica')
    const alertasAuditadas = await env.registroAuditoria.listar({ accion: 'conciliacion.alerta' }, { limite: 5 })
    expect(alertasAuditadas.elementos[0]?.detalles).toMatchObject({ severidad: 'critica', cargosCruzados: 4 })
  })

  it('si el listado de cargos de Openpay falla, cuenta un error y alerta (advertencia) sin tocar estados', async () => {
    const env = crearEntorno(
      pasarelaPrueba({
        listarCargos: async () => {
          throw new Error('timeout')
        },
      }),
    )
    const resumen = await env.conciliarPendientes()
    expect(resumen).toEqual({ revisadas: 0, actualizadas: 0, expiradas: 0, discrepancias: 0, errores: 1, cargosCruzados: 0 })
    expect(env.alertas).toEqual([
      {
        titulo: 'Conciliación diaria con discrepancias o errores',
        severidad: 'advertencia',
        detalles: { ...resumen, auditada: true },
      },
    ])
  })
})
