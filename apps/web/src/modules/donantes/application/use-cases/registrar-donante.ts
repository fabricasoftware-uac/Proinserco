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
 * Registra (o actualiza, si ya donó con el mismo documento) al donante y
 * guarda la prueba de cada autorización por separado. La autorización de
 * datos ya se exigió con `z.literal(true)` en el borde; aquí se registra.
 */
export function crearRegistrarDonante(deps: Dependencias) {
  return async function registrarDonante(solicitud: SolicitudRegistroDonante): Promise<Donante> {
    const parseo = DatosDonante.safeParse(solicitud.datos)
    if (!parseo.success) throw new DatosDonanteInvalidos()
    const datos = parseo.data
    const ahora = deps.reloj.ahora()

    const existente = await deps.donantes.buscarPorDocumento(datos.tipoDocumento, datos.numeroDocumento)
    const donante: Donante = existente
      ? {
          ...existente,
          ...datos,
          quiereCertificado: existente.quiereCertificado || solicitud.quiereCertificado,
          actualizadoEn: ahora,
        }
      : {
          ...datos,
          id: deps.ids.uuid() as DonanteId,
          quiereCertificado: solicitud.quiereCertificado,
          creadoEn: ahora,
          actualizadoEn: ahora,
        }
    await deps.donantes.guardar(donante)

    const base = {
      donanteId: donante.id,
      correo: donante.correo,
      versionTexto: deps.versionPoliticaDatos,
      otorgada: true,
      ip: solicitud.ip,
      userAgent: solicitud.userAgent,
    }
    await deps.registrarConsentimiento({ ...base, finalidad: 'gestion_donacion' })
    if (solicitud.quiereCertificado) await deps.registrarConsentimiento({ ...base, finalidad: 'certificado_donacion' })
    return donante
  }
}
