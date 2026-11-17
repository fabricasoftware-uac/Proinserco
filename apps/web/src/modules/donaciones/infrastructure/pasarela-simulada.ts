import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import { NoEncontrado } from '@/shared/domain/errores'
import type { Importe } from '@/shared/domain/importe'
import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '../application/ports/pasarela-pagos'

/** Ruta interna donde vive la pasarela simulada (solo con ADAPTADORES=memoria). */
export const RUTA_PASARELA_SIMULADA = '/donar/pasarela-simulada'

type CargoSimulado = {
  idCargo: string
  referencia: string
  importe: Importe
  descripcion: string
  estado: EstadoCargo
  metodoPago: string | null
  urlRetorno: string
}

export type VistaCargoSimulado = Readonly<{
  idCargo: string
  referencia: string
  montoPesos: number
  descripcion: string
  estado: EstadoCargo
}>

export type PasarelaSimulada = PasarelaPagos & {
  /** Para pintar la página de la pasarela simulada. */
  verCargo(idCargo: string): VistaCargoSimulado | null
  /** El "pagador" decide en la página simulada. Solo desde `pendiente`. Devuelve la URL de retorno. */
  resolverCargo(idCargo: string, resultado: 'aprobado' | 'rechazado'): string
  /** Datos semilla: registra un cargo ya existente. */
  sembrar(cargo: Omit<CargoSimulado, 'descripcion' | 'urlRetorno'>): void
  /** Tests: simula que la pasarela cambia un cargo (contracargo, reembolso, discrepancia). */
  forzarEstado(idCargo: string, estado: EstadoCargo, importe?: Importe): void
}

/**
 * Pasarela de pagos SIMULADA (entorno de pruebas). Imita el checkout
 * hospedado de Openpay: crea un cargo `pendiente` y devuelve una URL de pago
 * interna donde se elige aprobar o rechazar. Nunca pide datos de tarjeta.
 */
export function crearPasarelaSimulada(deps: { ids: GeneradorIds; urlBase: string }): PasarelaSimulada {
  const cargos = new Map<string, CargoSimulado>()

  function obtener(idCargo: string): CargoSimulado {
    const cargo = cargos.get(idCargo)
    if (!cargo) throw new NoEncontrado()
    return cargo
  }

  const consultar = (c: CargoSimulado): CargoConsultado => ({
    idCargo: c.idCargo,
    referencia: c.referencia,
    estado: c.estado,
    importe: c.importe,
    metodoPago: c.metodoPago,
  })

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
      })
      const urlPago = new URL(RUTA_PASARELA_SIMULADA, deps.urlBase)
      urlPago.searchParams.set('cargo', idCargo)
      return { idCargo, urlPago: urlPago.toString() }
    },
    async consultarCargo(idCargo) {
      return consultar(obtener(idCargo))
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
      cargos.set(cargo.idCargo, { ...cargo, descripcion: 'Donación a la Fundación Proinserco', urlRetorno: deps.urlBase })
    },
    forzarEstado(idCargo, estado, importe) {
      const c = obtener(idCargo)
      c.estado = estado
      if (importe) c.importe = importe
    },
  }
}
