import { NoEncontrado } from '@/shared/domain/errores'
import { pesosDeImporte } from '@/shared/domain/importe'
import { ReferenciaDonacion } from '../../domain/esquemas'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'
import type { crearConciliarDonacion } from './conciliar-donacion'

type Dependencias = {
  donaciones: RepositorioDonaciones
  conciliar: ReturnType<typeof crearConciliarDonacion>
  registrarFallo: (error: unknown) => void
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

/**
 * Página de retorno: lee el estado desde NUESTRO servidor. Si sigue
 * pendiente, consulta a la pasarela (conciliación). Los parámetros que
 * añade la pasarela a la URL de retorno se ignoran por completo.
 */
export function crearConsultarResultadoDonacion(deps: Dependencias) {
  return async function consultarResultadoDonacion(referencia: unknown): Promise<ResultadoPublicoDonacion> {
    const ref = ReferenciaDonacion.safeParse(referencia)
    if (!ref.success) throw new NoEncontrado()

    let donacion = await deps.donaciones.buscarPorReferencia(ref.data)
    if (!donacion) throw new NoEncontrado()

    if (donacion.estado === 'pendiente' || donacion.estado === 'creada') {
      try {
        await deps.conciliar({ referencia: ref.data }, 'conciliacion')
        donacion = (await deps.donaciones.buscarPorReferencia(ref.data)) ?? donacion
      } catch (error) {
        // Seguimos a propósito: si la pasarela no responde, el donante ve
        // "estamos confirmando tu pago" y el webhook o la conciliación diaria
        // resolverán el estado. Nunca se inventa un estado.
        deps.registrarFallo(error)
      }
    }

    const estado =
      donacion.estado === 'aprobada' || donacion.estado === 'reembolsada' || donacion.estado === 'contracargo'
        ? 'aprobada'
        : donacion.estado === 'pendiente' || donacion.estado === 'creada'
          ? 'pendiente'
          : 'rechazada'
    return {
      estado,
      montoPesos: pesosDeImporte(donacion.datos.importe),
      referencia: donacion.datos.referencia,
      fecha: donacion.datos.creadaEn,
      quiereCertificado: donacion.datos.quiereCertificado,
    }
  }
}
