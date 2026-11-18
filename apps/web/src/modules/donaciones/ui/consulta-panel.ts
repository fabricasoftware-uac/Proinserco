import type { Actor } from '@/shared/domain/actor'
import type { Pagina } from '@/shared/domain/paginacion'
import type { Donacion } from '../domain/donacion'
import { aFilaDonacion, type DonacionFilaVM } from './view-models'

/**
 * Consulta del listado de donaciones del panel con filtros y orden nativos
 * del repositorio y paginación por cursor.
 */
export type OrdenDonaciones = 'fecha' | 'monto' | 'estado'

export type ConsultaDonaciones = Readonly<{
  estado?: string | undefined
  linea?: string | undefined
  q?: string | undefined
  /** AAAA-MM-DD, día calendario de Colombia. */
  desde?: string | undefined
  hasta?: string | undefined
  minPesos?: number | undefined
  maxPesos?: number | undefined
  orden: OrdenDonaciones
  dir: 'asc' | 'desc'
  cursor?: string | undefined
  /** Conservado opcionalmente por compatibilidad de llamadas existentes. */
  pagina?: number | undefined
  limite: number
}>

export type ResultadoConsulta = Readonly<{
  filas: readonly DonacionFilaVM[]
  total: number
  siguienteCursor: string | null
  modo: 'cursor'
  hayMas: boolean
  truncado: false
}>

type Listar = (filtros: unknown, paginacion: unknown, actor: Actor) => Promise<Pagina<Donacion>>

const LOTE = 100

function filtrosDominio(c: ConsultaDonaciones): Record<string, unknown> {
  return {
    ...(c.estado ? { estado: c.estado } : {}),
    ...(c.linea ? { linea: c.linea } : {}),
    ...(c.q ? { q: c.q } : {}),
    ...(c.desde ? { desde: new Date(`${c.desde}T00:00:00-05:00`) } : {}),
    ...(c.hasta ? { hasta: new Date(`${c.hasta}T23:59:59.999-05:00`) } : {}),
    ...(c.minPesos !== undefined ? { minCentavos: BigInt(c.minPesos) * 100n } : {}),
    ...(c.maxPesos !== undefined ? { maxCentavos: BigInt(c.maxPesos) * 100n } : {}),
    orden: c.orden,
    dir: c.dir,
  }
}

/** Una página del listado (la usa la página del panel). */
export async function consultarDonaciones(listar: Listar, actor: Actor, c: ConsultaDonaciones): Promise<ResultadoConsulta> {
  const pagina = await listar(filtrosDominio(c), { limite: c.limite, ...(c.cursor ? { cursor: c.cursor } : {}) }, actor)
  return {
    filas: pagina.elementos.map(aFilaDonacion),
    total: pagina.total,
    siguienteCursor: pagina.cursorSiguiente,
    modo: 'cursor',
    hayMas: pagina.cursorSiguiente !== null,
    truncado: false,
  }
}

/** Todo lo filtrado (hasta `tope`) para exportar. */
export async function consultarParaExportar(listar: Listar, actor: Actor, c: ConsultaDonaciones, tope = 5000) {
  const filtros = filtrosDominio(c)
  const filas: DonacionFilaVM[] = []
  let cursor: string | undefined
  let truncado = false
  while (filas.length < tope) {
    const limite = Math.min(LOTE, tope - filas.length)
    const pagina = await listar(filtros, { limite, ...(cursor ? { cursor } : {}) }, actor)
    filas.push(...pagina.elementos.map(aFilaDonacion))
    if (!pagina.cursorSiguiente) break
    cursor = pagina.cursorSiguiente
    if (filas.length >= tope) truncado = true
  }
  return { filas: filas.slice(0, tope), truncado }
}
