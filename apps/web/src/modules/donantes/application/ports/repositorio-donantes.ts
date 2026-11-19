import type { Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donante, DonanteId } from '../../domain/donante'

export type DonanteRegistrado = Readonly<{
  /** Id al que se asocia la donación (el existente si el documento ya estaba registrado). */
  id: DonanteId
  /** true si ya existía un donante con ese tipo y número de documento. */
  existia: boolean
}>

export interface RepositorioDonantes {
  /**
   * Alta desde el flujo PÚBLICO (formulario de donar). Si ya existe un donante con el
   * mismo tipo y número de documento, NO modifica sus datos (nombres, correo, celular):
   * como mucho activa `quiereCertificado` (nunca lo desactiva) y devuelve su id para
   * asociarle la donación. Así nadie sobrescribe los datos de contacto de otra persona
   * escribiendo su documento. Los cambios de datos se hacen solo desde el panel.
   */
  registrarSiNoExiste(donante: Donante): Promise<DonanteRegistrado>
  buscarPorId(id: string): Promise<Donante | null>
  /** `q` busca por nombre, apellido o correo. */
  listar(filtros: { q?: string | undefined }, paginacion: Paginacion): Promise<Pagina<Donante>>
  contar(): Promise<number>
}
