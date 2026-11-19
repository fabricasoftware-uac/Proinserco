import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '@/modules/donaciones/application/ports/pasarela-pagos'
import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import { NoEncontrado } from '@/shared/domain/errores'
import type { Importe } from '@/shared/domain/importe'
import { exigirEntornoNoProductivo } from '@/shared/infrastructure/solo-desarrollo'

/** Página que hace de checkout hospedado en desarrollo (solo ADAPTADORES=memoria). */
export const RUTA_PASARELA_SIMULADA = '/donar/pasarela-simulada'

type CargoSimulado = {
  idCargo: string
  referencia: string
  importe: Importe
  /** Moneda que "reporta" la pasarela; por defecto la del importe. */
  monedaReportada?: string | undefined
  descripcion: string
  estado: EstadoCargo
  metodoPago: string | null
  urlRetorno: string
  creadoEn: Date
}

export type VistaCargoSimulado = Readonly<{
  idCargo: string
  referencia: string
  montoPesos: number
  descripcion: string
  estado: EstadoCargo
}>

export type PasarelaSimulada = PasarelaPagos & {
  verCargo(idCargo: string): VistaCargoSimulado | null
  resolverCargo(idCargo: string, resultado: 'aprobado' | 'rechazado'): string
  sembrar(cargo: Omit<CargoSimulado, 'descripcion' | 'urlRetorno' | 'creadoEn'> & { creadoEn?: Date }): void
  forzarEstado(idCargo: string, estado: EstadoCargo, importe?: Importe): void
  /** Simula que la pasarela reporta otra moneda (p. ej. 'USD'). */
  forzarMoneda(idCargo: string, moneda: string): void
}

/**
 * Pasarela de pagos SIMULADA: solo desarrollo local, E2E y pruebas unitarias
 * (ADAPTADORES=memoria). No pide ni acepta datos de tarjeta: la página
 * `/donar/pasarela-simulada` deja elegir aprobar o rechazar. Falla al instanciarse
 * con NODE_ENV=production.
 */
export function crearPasarelaSimulada(deps: { ids: GeneradorIds; urlBase: string }): PasarelaSimulada {
  exigirEntornoNoProductivo('La pasarela simulada')
  const cargos = new Map<string, CargoSimulado>()

  function obtener(idCargo: string): CargoSimulado {
    const cargo = cargos.get(idCargo)
    if (!cargo) throw new NoEncontrado()
    return cargo
  }

  const consultar = (c: CargoSimulado): CargoConsultado => {
    const moneda = c.monedaReportada ?? c.importe.moneda
    return {
      idCargo: c.idCargo,
      referencia: c.referencia,
      estado: c.estado,
      importe: moneda === 'COP' ? c.importe : null,
      monedaReportada: moneda,
      metodoPago: c.metodoPago,
    }
  }

  return {
    async crearCargo(solicitud) {
      const idCargo = `sim_${deps.ids.uuid().replaceAll('-', '')}`
      cargos.set(idCargo, {
        idCargo,
        referencia: solicitud.referencia,
        importe: solicitud.importe,
        descripcion: solicitud.descripcion,
        estado: 'pendiente',
        metodoPago: null,
        urlRetorno: solicitud.urlRetorno,
        creadoEn: new Date(),
      })
      const urlPago = new URL(RUTA_PASARELA_SIMULADA, deps.urlBase)
      urlPago.searchParams.set('cargo', idCargo)
      return { idCargo, urlPago: urlPago.toString() }
    },
    async consultarCargo(idCargo) {
      return consultar(obtener(idCargo))
    },
    async buscarCargoPorReferencia(referencia) {
      for (const c of cargos.values()) if (c.referencia === referencia) return consultar(c)
      return null
    },
    async listarCargos({ desde, hasta }) {
      return [...cargos.values()].filter((c) => c.creadoEn >= desde && c.creadoEn <= hasta).map(consultar)
    },
    verCargo(idCargo) {
      const c = cargos.get(idCargo)
      if (!c) return null
      return {
        idCargo: c.idCargo,
        referencia: c.referencia,
        montoPesos: Number(c.importe.centavos / 100n),
        descripcion: c.descripcion,
        estado: c.estado,
      }
    },
    resolverCargo(idCargo, resultado) {
      const c = obtener(idCargo)
      if (c.estado === 'pendiente') {
        c.estado = resultado
        c.metodoPago = 'tarjeta-simulada'
      }
      return c.urlRetorno
    },
    sembrar(cargo) {
      cargos.set(cargo.idCargo, {
        ...cargo,
        creadoEn: cargo.creadoEn ?? new Date(),
        descripcion: 'Donación a la Fundación Proinserco',
        urlRetorno: deps.urlBase,
      })
    },
    forzarEstado(idCargo, estado, importe) {
      const c = obtener(idCargo)
      c.estado = estado
      if (importe) c.importe = importe
    },
    forzarMoneda(idCargo, moneda) {
      obtener(idCargo).monedaReportada = moneda
    },
  }
}
