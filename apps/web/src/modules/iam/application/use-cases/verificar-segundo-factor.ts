import type { Auditor } from '@/shared/application/ports/auditor'
import { CodigoMfaInvalido } from '../../domain/errores'
import { CodigoMfa } from '../../domain/esquemas'
import type { Identidad } from '../../domain/identidad'
import type { AlmacenCookies } from '../ports/almacen-cookies'
import type { IdentityProvider } from '../ports/identity-provider'

type Dependencias = { identidad: IdentityProvider; auditor: Auditor }

/** Segundo factor TOTP obligatorio. Sin él no hay acceso al panel (aal2). */
export function crearVerificarSegundoFactor(deps: Dependencias) {
  return async function verificarSegundoFactor(entrada: unknown, cookies: AlmacenCookies, ip: string | null): Promise<Identidad> {
    const { codigo } = CodigoMfa.parse(entrada)
    try {
      const identidad = await deps.identidad.verificarSegundoFactor(codigo, cookies)
      await deps.auditor.registrar({
        accion: 'sesion.iniciada',
        actorId: identidad.usuarioId,
        recurso: 'sesion',
        recursoId: null,
        ip,
        detalles: { factor: 'totp', nivel: identidad.nivel },
      })
      return identidad
    } catch (error) {
      if (error instanceof CodigoMfaInvalido) {
        await deps.auditor.registrar({
          accion: 'sesion.mfa_fallido',
          actorId: (await deps.identidad.desafioPendiente(cookies)) ?? 'desconocido',
          recurso: 'sesion',
          recursoId: null,
          ip,
          detalles: { factor: 'totp' },
        })
      }
      throw error
    }
  }
}
