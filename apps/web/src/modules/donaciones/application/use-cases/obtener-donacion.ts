import type { Actor } from '@/shared/domain/actor'
import { NoEncontrado } from '@/shared/domain/errores'
import type { Donacion } from '../../domain/donacion'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'

type Dependencias = { donaciones: RepositorioDonaciones }

/** Detalle para el panel. Inexistente y sin permiso responden igual (404) en el borde. */
export function crearObtenerDonacion(deps: Dependencias) {
  return async function obtenerDonacion(id: string, actor: Actor): Promise<Donacion> {
    actor.exigir('donaciones:leer')
    const donacion = await deps.donaciones.buscarPorId(id)
    if (!donacion) throw new NoEncontrado()
    return donacion
  }
}
