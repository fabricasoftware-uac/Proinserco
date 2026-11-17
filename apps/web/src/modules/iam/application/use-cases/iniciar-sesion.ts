import type { Auditor } from '@/shared/application/ports/auditor'
import { CredencialesInvalidas } from '../../domain/errores'
import { Credenciales } from '../../domain/esquemas'
import type { AlmacenCookies } from '../ports/almacen-cookies'
import type { IdentityProvider } from '../ports/identity-provider'

type Dependencias = { identidad: IdentityProvider; auditor: Auditor }

/**
 * Primer factor. El rate limit (por IP y por correo) va ANTES, en la acción.
 * Los intentos fallidos quedan en la auditoría sin la contraseña.
 */
export function crearIniciarSesion(deps: Dependencias) {
  return async function iniciarSesion(
    entrada: unknown,
    cookies: AlmacenCookies,
    ip: string | null,
  ): Promise<{ requiereSegundoFactor: true }> {
    const credenciales = Credenciales.parse(entrada)
    try {
      const { usuarioId } = await deps.identidad.iniciarSesion(credenciales, cookies)
      await deps.auditor.registrar({
        accion: 'sesion.iniciada',
        actorId: usuarioId,
        recurso: 'sesion',
        recursoId: null,
        ip,
        detalles: { factor: 'contrasena' },
      })
      return { requiereSegundoFactor: true }
    } catch (error) {
      if (error instanceof CredencialesInvalidas) {
        await deps.auditor.registrar({
          accion: 'sesion.fallida',
          actorId: 'desconocido',
          recurso: 'sesion',
          recursoId: null,
          ip,
          detalles: { motivo: 'credenciales' },
        })
      }
      throw error
    }
  }
}
