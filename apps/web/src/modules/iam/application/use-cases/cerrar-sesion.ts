import type { Auditor } from '@/shared/application/ports/auditor'
import type { AlmacenCookies } from '../ports/almacen-cookies'
import type { IdentityProvider } from '../ports/identity-provider'

type Dependencias = { identidad: IdentityProvider; auditor: Auditor }

/** Revoca la sesión en servidor (no solo borra la cookie) y lo audita. */
export function crearCerrarSesion(deps: Dependencias) {
  return async function cerrarSesion(cookies: AlmacenCookies, ip: string | null): Promise<void> {
    const identidad = await deps.identidad.obtenerIdentidad(cookies)
    await deps.identidad.cerrarSesion(cookies)
    if (!identidad) return
    await deps.auditor.registrar({
      accion: 'sesion.cerrada',
      actorId: identidad.usuarioId,
      recurso: 'sesion',
      recursoId: null,
      ip,
      detalles: {},
    })
  }
}
