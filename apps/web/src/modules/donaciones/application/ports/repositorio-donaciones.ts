import type { Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donacion } from '../../domain/donacion'
import type { FiltrosDonaciones } from '../../domain/esquemas'
import type { EstadoDonacion } from '../../domain/estado-donacion'

export interface RepositorioDonaciones {
  /** Inserta una donación nueva. Falla si la referencia o la clave de idempotencia ya existen. */
  insertar(donacion: Donacion): Promise<void>
  /**
   * Transición condicional: guarda SOLO si el estado actual sigue siendo
   * `estadoEsperado` (`UPDATE … WHERE id = $1 AND estado = $2`). Devuelve false
   * si otro proceso (un webhook duplicado) ganó la carrera.
   */
  actualizarSiEstado(donacion: Donacion, estadoEsperado: EstadoDonacion): Promise<boolean>
  buscarPorId(id: string): Promise<Donacion | null>
  buscarPorReferencia(referencia: string): Promise<Donacion | null>
  buscarPorIdCargo(idCargo: string): Promise<Donacion | null>
  buscarPorClaveIdempotencia(clave: string): Promise<Donacion | null>
  listar(filtros: FiltrosDonaciones, paginacion: Paginacion): Promise<Pagina<Donacion>>
  /** Para los indicadores del resumen. El adaptador SQL lo resuelve con agregados. */
  listarDesde(desde: Date): Promise<readonly Donacion[]>
}
