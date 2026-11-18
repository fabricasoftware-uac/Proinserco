import type { Auditor } from '@/shared/application/ports/auditor'
import type { GeneradorIds } from '@/shared/application/ports/generador-ids'
import type { PublicadorEventos } from '@/shared/application/ports/publicador-eventos'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import { ErrorDeDominio, NoImplementado } from '@/shared/domain/errores'
import { pesosDeImporte } from '@/shared/domain/importe'
import { Donacion, type DonacionId } from '../../domain/donacion'
import { DonacionesDeshabilitadas, DonacionYaProcesada, PasarelaNoDisponible } from '../../domain/errores'
import { DonacionEntrada } from '../../domain/esquemas'
import { importeDeDonacion, type LimitesMonto } from '../../domain/monto'
import type { PasarelaPagos } from '../ports/pasarela-pagos'
import type { ContextoConsentimiento, RegistroDeDonantes } from '../ports/registro-de-donantes'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'

export type ConfiguracionDonaciones = Readonly<{
  limites: LimitesMonto
  /** Interruptor de emergencia (card testing, incidente): desactiva crear cargos sin desplegar. */
  habilitadas: boolean
  /** Origen absoluto del sitio (APP_URL) para construir la URL de retorno. */
  urlBase: string
}>

type Dependencias = {
  donaciones: RepositorioDonaciones
  pasarela: PasarelaPagos
  donantes: RegistroDeDonantes
  reloj: Reloj
  ids: GeneradorIds
  eventos: PublicadorEventos
  auditor: Auditor
  configuracion: ConfiguracionDonaciones
}

export type SolicitudDonacion = Readonly<{
  donacion: unknown
  /** Lo valida el módulo donantes a través del puerto. */
  donante: unknown
  quiereCertificado: boolean
  contexto: ContextoConsentimiento
}>

export type DonacionCreada = Readonly<{ referencia: string; urlPago: string }>

/**
 * Crea la intención de donación y el cargo en la pasarela.
 * Orden: interruptor → validación → idempotencia → donante → donación `creada`
 * → cargo → `pendiente`. El rate limit y el anti-bots van ANTES, en la acción.
 */
export function crearCrearDonacion(deps: Dependencias) {
  return async function crearDonacion(solicitud: SolicitudDonacion): Promise<DonacionCreada> {
    if (!deps.configuracion.habilitadas) throw new DonacionesDeshabilitadas()

    const entrada = DonacionEntrada.parse(solicitud.donacion)
    const importe = importeDeDonacion(entrada.montoPesos, deps.configuracion.limites)

    const previa = await deps.donaciones.buscarPorClaveIdempotencia(entrada.claveIdempotencia)
    if (previa) {
      // Doble clic o reintento: se devuelve el mismo cargo, nunca uno nuevo.
      if (previa.estado === 'pendiente' && previa.datos.urlPago) {
        return { referencia: previa.datos.referencia, urlPago: previa.datos.urlPago }
      }
      throw new DonacionYaProcesada()
    }

    const donante = await deps.donantes.registrar(solicitud.donante, solicitud.quiereCertificado, solicitud.contexto)
    const ahora = deps.reloj.ahora()
    const donacion = Donacion.crear(
      {
        id: deps.ids.uuid() as DonacionId,
        referencia: deps.ids.referencia(),
        claveIdempotencia: entrada.claveIdempotencia,
        importe,
        linea: entrada.linea,
        donanteId: donante.donanteId,
        pagador: { nombres: donante.nombres, apellidos: donante.apellidos, correo: donante.correo },
        quiereCertificado: solicitud.quiereCertificado,
      },
      ahora,
    )
    await deps.donaciones.insertar(donacion)

    const cargo = await crearCargoSeguro(deps, donacion)
    const pendiente = donacion.registrarCargo(cargo.idCargo, cargo.urlPago, deps.reloj.ahora())
    await deps.donaciones.actualizarSiEstado(pendiente, 'creada')

    await deps.auditor.registrar({
      accion: 'donacion.creada',
      actorId: ACTOR_SISTEMA,
      recurso: 'donacion',
      recursoId: donacion.id,
      ip: solicitud.contexto.ip,
      detalles: { montoPesos: pesosDeImporte(importe), linea: entrada.linea },
    })
    await deps.eventos.publicar({
      tipo: 'donacion.pendiente',
      ocurridoEn: ahora,
      datos: { donacionId: donacion.id, referencia: donacion.datos.referencia },
    })
    return { referencia: donacion.datos.referencia, urlPago: cargo.urlPago }
  }
}

async function crearCargoSeguro(deps: Dependencias, donacion: Donacion) {
  const { referencia, importe, pagador } = donacion.datos
  const urlRetorno = new URL('/donar/resultado', deps.configuracion.urlBase)
  urlRetorno.searchParams.set('referencia', referencia)
  try {
    return await deps.pasarela.crearCargo({
      referencia,
      importe,
      descripcion: 'Donación a la Fundación Proinserco',
      pagador,
      urlRetorno: urlRetorno.toString(),
    })
  } catch (error) {
    if (error instanceof NoImplementado) throw error
    if (error instanceof ErrorDeDominio && error.esPublico) throw error
    // La donación queda `creada` (abandonada); la conciliación la limpia.
    throw new PasarelaNoDisponible(error)
  }
}
