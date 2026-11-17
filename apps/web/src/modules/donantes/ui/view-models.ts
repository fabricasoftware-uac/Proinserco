import { enmascararCorreo, enmascararFinal } from '@/shared/domain/enmascarar'
import type { Pagina } from '@/shared/domain/paginacion'
import type { Consentimiento, FinalidadConsentimiento } from '../domain/consentimiento'
import type { Donante, TipoDocumento } from '../domain/donante'

/** Fila del listado. Datos personales SIEMPRE enmascarados. */
export type DonanteFilaVM = Readonly<{
  id: string
  nombre: string
  correoEnmascarado: string
  celularEnmascarado: string
  quiereCertificado: boolean
  creadoEn: string
}>

export type DonanteDetalleVM = DonanteFilaVM &
  Readonly<{
    tipoDocumento: TipoDocumento
    documentoEnmascarado: string
    consentimientos: readonly Readonly<{
      finalidad: FinalidadConsentimiento
      otorgada: boolean
      versionTexto: string
      creadoEn: string
    }>[]
  }>

export function aFilaDonante(d: Donante): DonanteFilaVM {
  return {
    id: d.id,
    nombre: `${d.nombres} ${d.apellidos}`,
    correoEnmascarado: enmascararCorreo(d.correo),
    celularEnmascarado: enmascararFinal(d.celular),
    quiereCertificado: d.quiereCertificado,
    creadoEn: d.creadoEn.toISOString(),
  }
}

export function aDetalleDonante(d: Donante, consentimientos: readonly Consentimiento[]): DonanteDetalleVM {
  return {
    ...aFilaDonante(d),
    tipoDocumento: d.tipoDocumento,
    documentoEnmascarado: enmascararFinal(d.numeroDocumento),
    consentimientos: consentimientos.map((c) => ({
      finalidad: c.finalidad,
      otorgada: c.otorgada,
      versionTexto: c.versionTexto,
      creadoEn: c.creadoEn.toISOString(),
    })),
  }
}

export function aPaginaDonantes(p: Pagina<Donante>) {
  return { elementos: p.elementos.map(aFilaDonante), cursorSiguiente: p.cursorSiguiente, total: p.total }
}
