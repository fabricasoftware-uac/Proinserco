import type { Importe } from '@/shared/domain/importe'
import type { Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donacion } from '../../domain/donacion'
import type { FiltrosDonaciones } from '../../domain/esquemas'
import type { EstadoDonacion } from '../../domain/estado-donacion'

/** Lo mínimo para resolver un reintento del formulario (idempotencia por clave). */
export type IntentoDonacion = Readonly<{
  referencia: string
  estado: EstadoDonacion
  /** Solo mientras la donación está `pendiente`. */
  urlPago: string | null
}>

/** Lo único que la página pública de resultado puede leer de una donación (sin datos personales). */
export type ResumenDonacionPublica = Readonly<{
  referencia: string
  estado: EstadoDonacion
  importe: Importe
  creadaEn: Date
  quiereCertificado: boolean
}>

/**
 * Persistencia de donaciones. Las operaciones marcadas como PÚBLICAS son las únicas
 * que el flujo público (rol `proinserco_publico`) puede ejecutar: en PostgreSQL pasan
 * por funciones SECURITY DEFINER acotadas, sin acceso directo a las tablas.
 */
export interface RepositorioDonaciones {
  /** PÚBLICA. Inserta una donación nueva (`creada`). Falla si la referencia o la clave ya existen. */
  insertar(donacion: Donacion): Promise<void>
  /**
   * Transición condicional: guarda SOLO si el estado actual sigue siendo
   * `estadoEsperado` (`UPDATE … WHERE id = $1 AND estado = $2`). Devuelve false
   * si otro proceso (un webhook duplicado) ganó la carrera.
   * En el flujo público solo se admite `creada` → `pendiente` (registrar el cargo).
   */
  actualizarSiEstado(donacion: Donacion, estadoEsperado: EstadoDonacion): Promise<boolean>
  buscarPorId(id: string): Promise<Donacion | null>
  buscarPorReferencia(referencia: string): Promise<Donacion | null>
  buscarPorIdCargo(idCargo: string): Promise<Donacion | null>
  /** PÚBLICA. Reintento del formulario: estado y URL de pago de la donación con esa clave. */
  buscarIntentoPorClave(clave: string): Promise<IntentoDonacion | null>
  /** PÚBLICA. UNA donación por su referencia, solo con lo que muestra /donar/resultado. */
  buscarResumenPublico(referencia: string): Promise<ResumenDonacionPublica | null>
  /**
   * PÚBLICA. Reserva atómicamente la consulta a la pasarela para una donación abierta
   * (`creada` o `pendiente`): true si han pasado al menos `intervaloSegundos` desde la
   * última reserva (o nunca se consultó). Así la página de resultado consulta a la
   * pasarela como mucho una vez cada N segundos por donación, aunque la recarguen.
   */
  reservarConsultaPasarela(referencia: string, intervaloSegundos: number): Promise<boolean>
  listar(filtros: FiltrosDonaciones, paginacion: Paginacion): Promise<Pagina<Donacion>>
  /** Para los indicadores del resumen. El adaptador SQL lo resuelve con agregados. */
  listarDesde(desde: Date): Promise<readonly Donacion[]>
}
