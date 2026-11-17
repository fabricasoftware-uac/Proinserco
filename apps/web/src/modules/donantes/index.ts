/** Barrel público del módulo donantes. */

export { CampoRevelable } from './application/use-cases/obtener-donante'
export type { Consentimiento, FinalidadConsentimiento } from './domain/consentimiento'
export { AutorizacionDatos } from './domain/consentimiento'
export type { Donante } from './domain/donante'
export { DatosDonante, type DatosDonanteEntrada, NOMBRES_TIPO_DOCUMENTO, TipoDocumento } from './domain/donante'
export { DatosDonanteInvalidos } from './domain/errores'
export {
  aDetalleDonante,
  aFilaDonante,
  aPaginaDonantes,
  type DonanteDetalleVM,
  type DonanteFilaVM,
} from './ui/view-models'
