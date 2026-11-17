import type { Reloj } from '@/shared/application/ports/reloj'
import type { Actor } from '@/shared/domain/actor'
import { pesosDeImporte } from '@/shared/domain/importe'
import type { EstadoDonacion } from '../../domain/estado-donacion'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'

type Dependencias = { donaciones: RepositorioDonaciones; reloj: Reloj }

export type PuntoSerie = Readonly<{ fecha: string; montoPesos: number; cantidad: number }>

export type IndicadoresResumen = Readonly<{
  recaudadoPesos: number
  aprobadas: number
  pendientes: number
  rechazadas: number
  ticketPromedioPesos: number
  /** Aprobadas / (aprobadas + rechazadas + expiradas), entre 0 y 1. */
  tasaAprobacion: number
  /** Últimos `dias` días, del más antiguo al más reciente, solo aprobadas. */
  serie: readonly PuntoSerie[]
}>

const DIA_MS = 86_400_000

/** Indicadores del resumen del panel en una ventana de días (UTC). */
export function crearObtenerIndicadores(deps: Dependencias) {
  return async function obtenerIndicadores(actor: Actor, dias = 30): Promise<IndicadoresResumen> {
    actor.exigir('donaciones:leer')
    const ahora = deps.reloj.ahora()
    const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
    const inicio = new Date(hoy - (dias - 1) * DIA_MS)
    const donaciones = await deps.donaciones.listarDesde(inicio)

    const contar = (e: EstadoDonacion) => donaciones.filter((d) => d.estado === e).length
    const aprobadas = donaciones.filter((d) => d.estado === 'aprobada')
    const recaudadoPesos = aprobadas.reduce((acc, d) => acc + pesosDeImporte(d.datos.importe), 0)
    const rechazadas = contar('rechazada') + contar('expirada')
    const resueltas = aprobadas.length + rechazadas

    const serie: PuntoSerie[] = Array.from({ length: dias }, (_, i) => ({
      fecha: new Date(inicio.getTime() + i * DIA_MS).toISOString().slice(0, 10),
      montoPesos: 0,
      cantidad: 0,
    }))
    for (const d of aprobadas) {
      const indice = Math.floor((d.datos.creadaEn.getTime() - inicio.getTime()) / DIA_MS)
      const punto = serie[indice]
      if (!punto) continue
      serie[indice] = {
        ...punto,
        montoPesos: punto.montoPesos + pesosDeImporte(d.datos.importe),
        cantidad: punto.cantidad + 1,
      }
    }

    return {
      recaudadoPesos,
      aprobadas: aprobadas.length,
      pendientes: contar('pendiente') + contar('creada'),
      rechazadas,
      ticketPromedioPesos: aprobadas.length ? Math.round(recaudadoPesos / aprobadas.length) : 0,
      tasaAprobacion: resueltas ? aprobadas.length / resueltas : 0,
      serie,
    }
  }
}
