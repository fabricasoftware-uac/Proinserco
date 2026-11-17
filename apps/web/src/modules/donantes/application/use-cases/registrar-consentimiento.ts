import type { Auditor } from '@/shared/application/ports/auditor'
import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import type { Consentimiento, FinalidadConsentimiento } from '../../domain/consentimiento'
import type { RegistroConsentimientos } from '../ports/registro-consentimientos'

type Dependencias = {
  consentimientos: RegistroConsentimientos
  reloj: Reloj
  ids: GeneradorIds
  auditor: Auditor
}

export type SolicitudConsentimiento = Readonly<{
  donanteId: string
  correo: string
  finalidad: FinalidadConsentimiento
  versionTexto: string
  otorgada: boolean
  ip: string | null
  userAgent: string | null
}>

/** Guarda la prueba de una autorización (o su revocación) como fila nueva. */
export function crearRegistrarConsentimiento(deps: Dependencias) {
  return async function registrarConsentimiento(solicitud: SolicitudConsentimiento): Promise<Consentimiento> {
    const consentimiento: Consentimiento = {
      ...solicitud,
      id: deps.ids.uuid(),
      userAgent: solicitud.userAgent?.slice(0, 300) ?? null,
      creadoEn: deps.reloj.ahora(),
    }
    await deps.consentimientos.insertar(consentimiento)
    await deps.auditor.registrar({
      accion: 'consentimiento.registrado',
      actorId: ACTOR_SISTEMA,
      recurso: 'donante',
      recursoId: solicitud.donanteId,
      ip: solicitud.ip,
      detalles: { finalidad: solicitud.finalidad, otorgada: solicitud.otorgada, versionTexto: solicitud.versionTexto },
    })
    return consentimiento
  }
}
