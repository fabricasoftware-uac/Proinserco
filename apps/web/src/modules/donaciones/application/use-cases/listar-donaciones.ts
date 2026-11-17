import type { Actor } from '@/shared/domain/actor'
import { type Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donacion } from '../../domain/donacion'
import { FiltrosDonaciones } from '../../domain/esquemas'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'

type Dependencias = { donaciones: RepositorioDonaciones }

/** Listado del panel con filtros (lista blanca) y paginación por cursor. */
export function crearListarDonaciones(deps: Dependencias) {
  return async function listarDonaciones(filtros: unknown, paginacion: unknown, actor: Actor): Promise<Pagina<Donacion>> {
    actor.exigir('donaciones:leer')
    return deps.donaciones.listar(FiltrosDonaciones.parse(filtros ?? {}), Paginacion.parse(paginacion ?? {}))
  }
}
