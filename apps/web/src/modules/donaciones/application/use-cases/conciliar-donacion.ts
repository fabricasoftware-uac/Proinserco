import type { Auditor } from '@/shared/application/ports/auditor'
import type { PublicadorEventos } from '@/shared/application/ports/publicador-eventos'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import { importesIguales } from '@/shared/domain/importe'
import type { Donacion } from '../../domain/donacion'
import { type EstadoDonacion, esTransicionValida, type OrigenTransicion } from '../../domain/estado-donacion'
import type { EstadoCargo, PasarelaPagos } from '../ports/pasarela-pagos'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'

type Dependencias = {
  donaciones: RepositorioDonaciones
  pasarela: PasarelaPagos
  reloj: Reloj
  eventos: PublicadorEventos
  auditor: Auditor
}

export type ResultadoConciliacion =
  | { resultado: 'sin_cambios'; estado: EstadoDonacion }
  | { resultado: 'actualizada'; estado: EstadoDonacion }
  | { resultado: 'no_encontrada' }
  | { resultado: 'sin_cargo'; estado: EstadoDonacion }
  | { resultado: 'discrepancia'; estado: EstadoDonacion }
  | { resultado: 'transicion_invalida'; estado: EstadoDonacion; estadoPasarela: EstadoCargo }
  | { resultado: 'carrera_perdida'; estado: EstadoDonacion }

const ESTADO_POR_CARGO: Readonly<Record<EstadoCargo, EstadoDonacion>> = {
  pendiente: 'pendiente',
  aprobado: 'aprobada',
  rechazado: 'rechazada',
  expirado: 'expirada',
  reembolsado: 'reembolsada',
  contracargo: 'contracargo',
}

export type IdentificadorConciliacion = { referencia: string } | { idCargo: string }

/**
 * Lleva la donación al estado que dice la PASARELA. Es lo único que confirma
 * o rechaza una donación: lo invocan el webhook, la página de resultado (si
 * sigue pendiente), la pasarela simulada y la conciliación diaria.
 *
 * - Fuente de verdad: `pasarela.consultarCargo` con la llave privada. Nunca el
 *   cuerpo de un webhook ni la URL de retorno.
 * - Importe y moneda deben coincidir con los nuestros; si no, no se aprueba.
 * - Idempotente: repetirla con el mismo estado no cambia nada.
 * - Solo transiciones válidas, con guardado condicional por estado.
 */
export function crearConciliarDonacion(deps: Dependencias) {
  return async function conciliarDonacion(
    id: IdentificadorConciliacion,
    origen: OrigenTransicion = 'conciliacion',
  ): Promise<ResultadoConciliacion> {
    let donacion =
      'referencia' in id
        ? await deps.donaciones.buscarPorReferencia(id.referencia)
        : await deps.donaciones.buscarPorIdCargo(id.idCargo)
    let cargoPreconsultado: Awaited<ReturnType<PasarelaPagos['consultarCargo']>> | null = null

    if (!donacion && 'idCargo' in id) {
      cargoPreconsultado = await deps.pasarela.consultarCargo(id.idCargo)
      if (cargoPreconsultado.referencia) {
        donacion = await deps.donaciones.buscarPorReferencia(cargoPreconsultado.referencia)
      }
    }

    if (!donacion) return { resultado: 'no_encontrada' }
    if (!donacion.datos.idCargo) return { resultado: 'sin_cargo', estado: donacion.estado }

    const cargo = cargoPreconsultado ?? (await deps.pasarela.consultarCargo(donacion.datos.idCargo))
    const destino = ESTADO_POR_CARGO[cargo.estado]

    if (cargo.referencia !== donacion.datos.referencia || !importesIguales(cargo.importe, donacion.datos.importe)) {
      await auditarDiscrepancia(deps, donacion, cargo.estado)
      return { resultado: 'discrepancia', estado: donacion.estado }
    }
    if (destino === donacion.estado) return { resultado: 'sin_cambios', estado: donacion.estado }

    const camino = caminoHasta(donacion.estado, destino)
    if (!camino) {
      await auditarTransicion(deps, donacion, destino, false)
      return { resultado: 'transicion_invalida', estado: donacion.estado, estadoPasarela: cargo.estado }
    }

    let actual = donacion
    for (const paso of camino) {
      const siguiente = actual.transicionar(paso, deps.reloj.ahora(), origen, { metodoPago: cargo.metodoPago })
      const guardada = await deps.donaciones.actualizarSiEstado(siguiente, actual.estado)
      if (!guardada) {
        const vigente = await deps.donaciones.buscarPorId(donacion.id)
        return { resultado: 'carrera_perdida', estado: vigente?.estado ?? actual.estado }
      }
      await auditarTransicion(deps, actual, paso, true)
      actual = siguiente
    }

    await deps.eventos.publicar({
      tipo: `donacion.${actual.estado}`,
      ocurridoEn: deps.reloj.ahora(),
      datos: { donacionId: actual.id, referencia: actual.datos.referencia },
    })
    return { resultado: 'actualizada', estado: actual.estado }
  }
}

/** Una donación que se quedó en `creada` pasa primero por `pendiente`. */
function caminoHasta(desde: EstadoDonacion, hacia: EstadoDonacion): EstadoDonacion[] | null {
  if (esTransicionValida(desde, hacia)) return [hacia]
  if (desde === 'creada' && esTransicionValida('pendiente', hacia)) return ['pendiente', hacia]
  return null
}

async function auditarTransicion(deps: Dependencias, donacion: Donacion, hacia: EstadoDonacion, aplicada: boolean) {
  await deps.auditor.registrar({
    accion: 'donacion.transicion',
    actorId: ACTOR_SISTEMA,
    recurso: 'donacion',
    recursoId: donacion.id,
    ip: null,
    detalles: { desde: donacion.estado, hacia, aplicada },
  })
}

async function auditarDiscrepancia(deps: Dependencias, donacion: Donacion, estadoPasarela: EstadoCargo) {
  await deps.auditor.registrar({
    accion: 'donacion.discrepancia',
    actorId: ACTOR_SISTEMA,
    recurso: 'donacion',
    recursoId: donacion.id,
    ip: null,
    detalles: { estadoLocal: donacion.estado, estadoPasarela },
  })
}
