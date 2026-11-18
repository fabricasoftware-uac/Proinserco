import { describe, expect, it, vi } from 'vitest'
import { crearRegistrarAuditoria } from '@/modules/auditoria/application/use-cases/registrar-auditoria'
import { crearRegistroAuditoriaMemoria } from '@/modules/auditoria/infrastructure/registro-auditoria-memoria'
import type { Auditor } from '@/shared/application/ports/auditor'
import { importeDesdePesos } from '@/shared/domain/importe'
import { crearPublicadorEventosMemoria } from '@/shared/infrastructure/publicador-eventos-memoria'
import { crearRelojFijo } from '@/shared/infrastructure/reloj'
import { crearIdsSecuenciales } from '@/test/mundo-memoria'
import { Donacion, type DonacionId } from '../../domain/donacion'
import { crearRepositorioDonacionesMemoria } from '../../infrastructure/repositorio-donaciones-memoria'
import type { PasarelaPagos } from '../ports/pasarela-pagos'
import { crearConciliarDonacion } from './conciliar-donacion'
import { crearConciliarPendientes, type ResumenConciliacionPendientes } from './conciliar-pendientes'

const BASE = new Date('2026-11-16T15:00:00.000Z')
const MINUTO = 60_000

function crearEntorno(pasarela: PasarelaPagos, alAlertar?: (resumen: ResumenConciliacionPendientes) => void) {
  const reloj = crearRelojFijo(BASE)
  const ids = crearIdsSecuenciales()
  const eventos = crearPublicadorEventosMemoria()
  const registroAuditoria = crearRegistroAuditoriaMemoria()
  const auditor: Auditor = { registrar: crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids }) }
  const donaciones = crearRepositorioDonacionesMemoria()
  const conciliar = crearConciliarDonacion({ donaciones, pasarela, reloj, eventos, auditor })
  const conciliarPendientes = crearConciliarPendientes({ donaciones, conciliar, reloj, auditor, alAlertar })
  return { reloj, ids, donaciones, registroAuditoria, conciliarPendientes }
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
    const alAlertar = vi.fn()
    const env = crearEntorno({ crearCargo: vi.fn(), consultarCargo }, alAlertar)

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
    })
    expect(alAlertar).not.toHaveBeenCalled()
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
    const alAlertar = vi.fn()
    const env = crearEntorno({ crearCargo: vi.fn(), consultarCargo }, alAlertar)

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
    })
    expect(alAlertar).toHaveBeenCalledTimes(1)
    expect(alAlertar).toHaveBeenCalledWith(resumen)
  })

  it('si una donación creada sin idCargo > 60 min pierde la carrera al expirar, no falla ni incrementa expiradas', async () => {
    const reloj = crearRelojFijo(BASE)
    const ids = crearIdsSecuenciales()
    const eventos = crearPublicadorEventosMemoria()
    const registroAuditoria = crearRegistroAuditoriaMemoria()
    const auditor: Auditor = { registrar: crearRegistrarAuditoria({ registro: registroAuditoria, reloj, ids }) }
    const repoBase = crearRepositorioDonacionesMemoria()

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

    const pasarela: PasarelaPagos = { crearCargo: vi.fn(), consultarCargo: vi.fn() }
    const conciliar = crearConciliarDonacion({ donaciones: repoConCarrera, pasarela, reloj, eventos, auditor })
    const alAlertar = vi.fn()
    const conciliarPendientes = crearConciliarPendientes({ donaciones: repoConCarrera, conciliar, reloj, auditor, alAlertar })

    const resumen = await conciliarPendientes()
    expect(resumen).toEqual({
      revisadas: 1,
      actualizadas: 0,
      expiradas: 0,
      discrepancias: 0,
      errores: 0,
    })
    expect(alAlertar).not.toHaveBeenCalled()
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
    const alAlertar = vi.fn()
    const env = crearEntorno({ crearCargo: vi.fn(), consultarCargo }, alAlertar)

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
    })
    expect(alAlertar).not.toHaveBeenCalled()
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
})
