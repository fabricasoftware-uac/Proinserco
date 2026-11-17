/**
 * Barrel público del módulo donaciones. Lo que no está aquí es privado.
 * Las rutas (app/) y los flujos lo usan; los adaptadores solo los importa
 * el composition root (src/server/container.ts).
 */

export type { ResultadoPublicoDonacion } from './application/use-cases/consultar-resultado-donacion'
export type { DonacionCreada } from './application/use-cases/crear-donacion'
export type { IndicadoresResumen, PuntoSerie } from './application/use-cases/obtener-indicadores'
export type { Donacion } from './domain/donacion'
export { DonacionesDeshabilitadas, DonacionYaProcesada, MontoFueraDeRango, PasarelaNoDisponible } from './domain/errores'
export { DonacionEntrada, FiltrosDonaciones, ReferenciaDonacion } from './domain/esquemas'
export { EstadoDonacion, esTransicionValida, TRANSICIONES } from './domain/estado-donacion'
export { LineaApoyo } from './domain/linea-apoyo'
export { type LimitesMonto, MontoPesos } from './domain/monto'
export {
  aDetalleDonacion,
  aFilaDonacion,
  aPaginaDonaciones,
  type DonacionDetalleVM,
  type DonacionFilaVM,
  type PaginaVM,
} from './ui/view-models'
