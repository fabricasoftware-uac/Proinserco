import { Actor } from '@/shared/domain/actor'
import { PERMISOS_POR_ROL } from '../../domain/roles'
import type { AlmacenCookies } from '../ports/almacen-cookies'
import type { IdentityProvider } from '../ports/identity-provider'

type Dependencias = { identidad: IdentityProvider }

/**
 * Actor de la petición, o null. Exige segundo factor (aal2): una sesión que
 * solo pasó la contraseña NO es un actor del panel.
 */
export function crearObtenerActor(deps: Dependencias) {
  return async function obtenerActor(cookies: AlmacenCookies): Promise<Actor | null> {
    const identidad = await deps.identidad.obtenerIdentidad(cookies)
    if (identidad?.nivel !== 'aal2') return null
    return new Actor(
      identidad.usuarioId,
      identidad.nombre,
      identidad.correo,
      identidad.rol,
      PERMISOS_POR_ROL[identidad.rol],
      identidad.nivel,
    )
  }
}
