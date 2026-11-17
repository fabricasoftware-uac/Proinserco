import { enmascararCorreo } from '@/shared/domain/enmascarar'
import { pesosDeImporte } from '@/shared/domain/importe'
import type { Pagina } from '@/shared/domain/paginacion'
import type { Donacion } from '../domain/donacion'
import type { EstadoDonacion } from '../domain/estado-donacion'
import type { LineaApoyo } from '../domain/linea-apoyo'

/**
 * View models: EXACTAMENTE lo que pinta la vista. Es lo único que se pasa
 * a un componente cliente (sus props se publican en el HTML). Datos
 * personales enmascarados por defecto.
 */
export type DonacionFilaVM = Readonly<{
  id: string
  referencia: string
  estado: EstadoDonacion
  montoPesos: number
  linea: LineaApoyo
  donanteId: string
  donante: string
  correoEnmascarado: string
  creadaEn: string
}>

export type DonacionDetalleVM = DonacionFilaVM &
  Readonly<{
    quiereCertificado: boolean
    metodoPago: string | null
    /** Id del cargo en la pasarela. Nunca datos de tarjeta. */
    idCargo: string | null
    actualizadaEn: string
    historial: readonly Readonly<{ desde: EstadoDonacion; hacia: EstadoDonacion; en: string; origen: string }>[]
  }>

export type PaginaVM<T> = Readonly<{ elementos: readonly T[]; cursorSiguiente: string | null; total: number }>

export function aFilaDonacion(donacion: Donacion): DonacionFilaVM {
  const d = donacion.datos
  return {
    id: d.id,
    referencia: d.referencia,
    estado: d.estado,
    montoPesos: pesosDeImporte(d.importe),
    linea: d.linea,
    donanteId: d.donanteId,
    donante: `${d.pagador.nombres} ${d.pagador.apellidos.slice(0, 1)}.`,
    correoEnmascarado: enmascararCorreo(d.pagador.correo),
    creadaEn: d.creadaEn.toISOString(),
  }
}

export function aDetalleDonacion(donacion: Donacion): DonacionDetalleVM {
  const d = donacion.datos
  return {
    ...aFilaDonacion(donacion),
    quiereCertificado: d.quiereCertificado,
    metodoPago: d.metodoPago,
    idCargo: d.idCargo,
    actualizadaEn: d.actualizadaEn.toISOString(),
    historial: d.historial.map((t) => ({ desde: t.desde, hacia: t.hacia, en: t.en.toISOString(), origen: t.origen })),
  }
}

export function aPaginaDonaciones(pagina: Pagina<Donacion>): PaginaVM<DonacionFilaVM> {
  return { elementos: pagina.elementos.map(aFilaDonacion), cursorSiguiente: pagina.cursorSiguiente, total: pagina.total }
}
