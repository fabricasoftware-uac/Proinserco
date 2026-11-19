import type { Auditor } from '@/shared/application/ports/auditor'
import type { PublicadorEventos } from '@/shared/application/ports/publicador-eventos'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import { importesIguales } from '@/shared/domain/importe'
import type { Donacion } from '../../domain/donacion'
import { ReferenciaDonacion } from '../../domain/esquemas'
import { type EstadoDonacion, esTransicionValida, type OrigenTransicion } from '../../domain/estado-donacion'
import type { CargoConsultado, EstadoCargo, PasarelaPagos } from '../ports/pasarela-pagos'
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

/**
 * Qué donación conciliar. El webhook manda el id del cargo y, si viene, la referencia
 * (`order_id`) como respaldo: si `crearCargo` funcionó pero falló guardar el `idCargo`,
 * la donación solo se encuentra por referencia. Ninguno de los dos se cree sin más:
 * el cargo se consulta a la pasarela y su `order_id` debe coincidir con la referencia.
 */
export type IdentificadorConciliacion = { referencia: string } | { idCargo: string; referenciaRespaldo?: string | undefined }

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
    const { donacion, cargoPreconsultado } = await buscarDonacion(deps, id)
    if (!donacion) return { resultado: 'no_encontrada' }

    // Sin idCargo guardado (falló el UPDATE tras crear el cargo): se recupera el cargo
    // consultando a la pasarela, por el id que trae el aviso o por nuestra referencia.
    // Si ya se consultó para encontrar la donación, se reutiliza: Openpay se consulta una vez.
    const sinIdCargo = !donacion.datos.idCargo
    const cargo = cargoPreconsultado ?? (await obtenerCargo(deps, donacion, id))
    if (!cargo) return { resultado: 'sin_cargo', estado: donacion.estado }
    const destino = ESTADO_POR_CARGO[cargo.estado]

    const motivo = motivoDiscrepancia(donacion, cargo)
    if (motivo) {
      await auditarDiscrepancia(deps, donacion, cargo, motivo)
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
      const cambios = sinIdCargo && !actual.datos.idCargo ? { idCargo: cargo.idCargo } : {}
      const siguiente = actual.transicionar(paso, deps.reloj.ahora(), origen, { metodoPago: cargo.metodoPago, ...cambios })
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

type DonacionLocalizada = Readonly<{ donacion: Donacion | null; cargoPreconsultado: CargoConsultado | null }>

/**
 * Localiza la donación: por referencia, por idCargo guardado o por la referencia de respaldo
 * del aviso. Con checkout multimétodo guardamos el id del checkout (`ck…`) y el aviso trae el
 * de la transacción (`tr…`), así que si nada de eso basta se CONSULTA el cargo a la pasarela
 * y se busca por su `order_id` (nunca por datos del aviso). Ese cargo se devuelve para no
 * consultarlo otra vez; la verificación de referencia, importe y moneda se hace igual después.
 */
async function buscarDonacion(deps: Dependencias, id: IdentificadorConciliacion): Promise<DonacionLocalizada> {
  const sinCargo = (donacion: Donacion | null): DonacionLocalizada => ({ donacion, cargoPreconsultado: null })
  if ('referencia' in id) return sinCargo(await deps.donaciones.buscarPorReferencia(id.referencia))

  const porCargo = await deps.donaciones.buscarPorIdCargo(id.idCargo)
  if (porCargo) return sinCargo(porCargo)
  if (id.referenciaRespaldo) {
    const porRespaldo = await deps.donaciones.buscarPorReferencia(id.referenciaRespaldo)
    if (porRespaldo) return sinCargo(porRespaldo)
  }

  const cargo = await deps.pasarela.consultarCargo(id.idCargo)
  if (!ReferenciaDonacion.safeParse(cargo.referencia).success) return sinCargo(null)
  const donacion = await deps.donaciones.buscarPorReferencia(cargo.referencia)
  return { donacion, cargoPreconsultado: donacion ? cargo : null }
}

async function obtenerCargo(
  deps: Dependencias,
  donacion: Donacion,
  id: IdentificadorConciliacion,
): Promise<CargoConsultado | null> {
  if (donacion.datos.idCargo) return deps.pasarela.consultarCargo(donacion.datos.idCargo)
  if ('idCargo' in id) return deps.pasarela.consultarCargo(id.idCargo)
  return deps.pasarela.buscarCargoPorReferencia(donacion.datos.referencia)
}

type MotivoDiscrepancia = 'referencia' | 'moneda' | 'importe'

function motivoDiscrepancia(donacion: Donacion, cargo: CargoConsultado): MotivoDiscrepancia | null {
  if (cargo.referencia !== donacion.datos.referencia) return 'referencia'
  if (!cargo.importe) return 'moneda'
  if (!importesIguales(cargo.importe, donacion.datos.importe)) return 'importe'
  return null
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

async function auditarDiscrepancia(deps: Dependencias, donacion: Donacion, cargo: CargoConsultado, motivo: MotivoDiscrepancia) {
  await deps.auditor.registrar({
    accion: 'donacion.discrepancia',
    actorId: ACTOR_SISTEMA,
    recurso: 'donacion',
    recursoId: donacion.id,
    ip: null,
    detalles: {
      estadoLocal: donacion.estado,
      estadoPasarela: cargo.estado,
      motivo,
      monedaPasarela: cargo.monedaReportada,
      severidad: 'alta',
    },
  })
}
