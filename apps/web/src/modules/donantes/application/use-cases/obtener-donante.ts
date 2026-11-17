import { z } from 'zod'
import type { Auditor } from '@/shared/application/ports/auditor'
import type { Actor } from '@/shared/domain/actor'
import { NoEncontrado } from '@/shared/domain/errores'
import type { Consentimiento } from '../../domain/consentimiento'
import type { Donante } from '../../domain/donante'
import type { RegistroConsentimientos } from '../ports/registro-consentimientos'
import type { RepositorioDonantes } from '../ports/repositorio-donantes'

type Dependencias = { donantes: RepositorioDonantes; consentimientos: RegistroConsentimientos; auditor: Auditor }

/** Detalle del donante con su historial de autorizaciones. La vista lo enmascara. */
export function crearObtenerDonante(deps: Dependencias) {
  return async function obtenerDonante(
    id: string,
    actor: Actor,
  ): Promise<{ donante: Donante; consentimientos: readonly Consentimiento[] }> {
    actor.exigir('donantes:leer')
    const donante = await deps.donantes.buscarPorId(id)
    if (!donante) throw new NoEncontrado()
    return { donante, consentimientos: await deps.consentimientos.listarPorDonante(id) }
  }
}

export const CampoRevelable = z.enum(['correo', 'celular', 'numeroDocumento'])
export type CampoRevelable = z.infer<typeof CampoRevelable>

/**
 * "Mostrar" un dato personal enmascarado. Exige permiso propio y SIEMPRE
 * queda en la auditoría (sin el valor revelado).
 */
export function crearRevelarDatoDonante(deps: Dependencias) {
  return async function revelarDatoDonante(id: string, campo: unknown, actor: Actor, ip: string | null): Promise<string> {
    actor.exigir('donantes:revelar')
    const campoValido = CampoRevelable.parse(campo)
    const donante = await deps.donantes.buscarPorId(id)
    if (!donante) throw new NoEncontrado()
    await deps.auditor.registrar({
      accion: 'donante.dato_revelado',
      actorId: actor.usuarioId,
      recurso: 'donante',
      recursoId: id,
      ip,
      detalles: { campo: campoValido },
    })
    return donante[campoValido]
  }
}
