import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import type { Reloj } from '@/shared/application/ports/reloj'
import { DatosDonante, type Donante, type DonanteId } from '../../domain/donante'
import { DatosDonanteInvalidos } from '../../domain/errores'
import type { RepositorioDonantes } from '../ports/repositorio-donantes'
import type { crearRegistrarConsentimiento } from './registrar-consentimiento'

type Dependencias = {
  donantes: RepositorioDonantes
  registrarConsentimiento: ReturnType<typeof crearRegistrarConsentimiento>
  reloj: Reloj
  ids: GeneradorIds
  /** Versión vigente de la política de tratamiento de datos (la decide el contenido legal). */
  versionPoliticaDatos: string
}

export type SolicitudRegistroDonante = Readonly<{
  datos: unknown
  quiereCertificado: boolean
  ip: string | null
  userAgent: string | null
}>

/**
 * Resultado del alta pública: el id al que se asocia la donación y los datos que
 * ESCRIBIÓ quien dona (instantánea del pagador). Si el documento ya existía, los
 * datos guardados del donante NO se devuelven ni se modifican: nunca se filtran
 * los datos de otra persona al flujo público.
 */
export type DonanteRegistrado = DatosDonante & Readonly<{ id: DonanteId; existia: boolean }>

/**
 * Registra al donante (o lo asocia, si ya donó con el mismo documento, SIN tocar sus
 * datos de contacto) y guarda la prueba de cada autorización por separado. La
 * autorización de datos ya se exigió con `z.literal(true)` en el borde; aquí se registra.
 */
export function crearRegistrarDonante(deps: Dependencias) {
  return async function registrarDonante(solicitud: SolicitudRegistroDonante): Promise<DonanteRegistrado> {
    const parseo = DatosDonante.safeParse(solicitud.datos)
    if (!parseo.success) throw new DatosDonanteInvalidos()
    const datos = parseo.data
    const ahora = deps.reloj.ahora()

    const candidato: Donante = {
      ...datos,
      id: deps.ids.uuid() as DonanteId,
      quiereCertificado: solicitud.quiereCertificado,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    const { id, existia } = await deps.donantes.registrarSiNoExiste(candidato)

    const base = {
      donanteId: id,
      // El correo que la persona escribió y autorizó (prueba de la autorización).
      correo: datos.correo,
      versionTexto: deps.versionPoliticaDatos,
      otorgada: true,
      ip: solicitud.ip,
      userAgent: solicitud.userAgent,
    }
    await deps.registrarConsentimiento({ ...base, finalidad: 'gestion_donacion' })
    if (solicitud.quiereCertificado) await deps.registrarConsentimiento({ ...base, finalidad: 'certificado_donacion' })
    return { ...datos, id, existia }
  }
}
