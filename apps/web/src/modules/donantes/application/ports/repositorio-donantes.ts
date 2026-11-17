import type { Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donante, TipoDocumento } from '../../domain/donante'

export interface RepositorioDonantes {
  /** Inserta o actualiza (por id). */
  guardar(donante: Donante): Promise<void>
  buscarPorId(id: string): Promise<Donante | null>
  buscarPorDocumento(tipo: TipoDocumento, numero: string): Promise<Donante | null>
  /** `q` busca por nombre, apellido o correo. */
  listar(filtros: { q?: string | undefined }, paginacion: Paginacion): Promise<Pagina<Donante>>
  contar(): Promise<number>
}
