import { NoEncontrado } from '@/shared/domain/errores'
import { pesosDeImporte } from '@/shared/domain/importe'
import { ReferenciaDonacion } from '../../domain/esquemas'
import type { EstadoDonacion } from '../../domain/estado-donacion'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'
import type { crearConciliarDonacion } from './conciliar-donacion'

/** Como mucho una consulta a la pasarela por donación cada N segundos desde esta página. */
export const SEGUNDOS_ENTRE_CONSULTAS_PASARELA = 30

type Dependencias = {
  donaciones: RepositorioDonaciones
  /**
   * Conciliación (consulta autoritativa a la pasarela). El composition root la ejecuta
   * con el rol de SISTEMA; la lectura de esta página va con el rol público acotado.
   */
  conciliar: ReturnType<typeof crearConciliarDonacion>
  registrarFallo: (error: unknown) => void
  segundosEntreConsultas?: number | undefined
}

/** Lo único que ve el donante en /donar/resultado. Sin datos personales. */
export type ResultadoPublicoDonacion = Readonly<{
  estado: 'aprobada' | 'pendiente' | 'rechazada'
  montoPesos: number
  referencia: string
  /** Fecha de creación de la donación (no la hora de la consulta). */
  fecha: Date
  quiereCertificado: boolean
}>

function estadoPublico(estado: EstadoDonacion): ResultadoPublicoDonacion['estado'] {
  if (estado === 'aprobada' || estado === 'reembolsada' || estado === 'contracargo') return 'aprobada'
  if (estado === 'pendiente' || estado === 'creada') return 'pendiente'
  return 'rechazada'
}

/**
 * Página de retorno: lee el estado desde NUESTRO servidor (función pública acotada,
 * una donación por referencia). Si sigue abierta, consulta a la pasarela como mucho
 * una vez cada N segundos por donación (reserva atómica en BD, válida con varias
 * instancias). Los parámetros que añade la pasarela a la URL de retorno se ignoran.
 */
export function crearConsultarResultadoDonacion(deps: Dependencias) {
  const intervalo = deps.segundosEntreConsultas ?? SEGUNDOS_ENTRE_CONSULTAS_PASARELA

  return async function consultarResultadoDonacion(referencia: unknown): Promise<ResultadoPublicoDonacion> {
    const ref = ReferenciaDonacion.safeParse(referencia)
    if (!ref.success) throw new NoEncontrado()

    let resumen = await deps.donaciones.buscarResumenPublico(ref.data)
    if (!resumen) throw new NoEncontrado()

    if (resumen.estado === 'pendiente' || resumen.estado === 'creada') {
      try {
        if (await deps.donaciones.reservarConsultaPasarela(ref.data, intervalo)) {
          await deps.conciliar({ referencia: ref.data }, 'conciliacion')
          resumen = (await deps.donaciones.buscarResumenPublico(ref.data)) ?? resumen
        }
      } catch (error) {
        // Seguimos a propósito: si la pasarela no responde, el donante ve
        // "estamos confirmando tu pago" y el webhook o la conciliación diaria
        // resolverán el estado. Nunca se inventa un estado.
        deps.registrarFallo(error)
      }
    }

    return {
      estado: estadoPublico(resumen.estado),
      montoPesos: pesosDeImporte(resumen.importe),
      referencia: resumen.referencia,
      fecha: resumen.creadaEn,
      quiereCertificado: resumen.quiereCertificado,
    }
  }
}
