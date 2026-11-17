import type { Actor } from '@/shared/domain/actor'
import type { Pagina } from '@/shared/domain/paginacion'
import type { Donacion } from '../domain/donacion'
import { aFilaDonacion, type DonacionFilaVM } from './view-models'

/**
 * Consulta del listado de donaciones del panel. El puerto solo ofrece filtros por
 * estado/linea/texto/fechas y orden por fecha descendente con cursor. Mientras el
 * adaptador SQL no filtre por monto ni ordene por otras columnas, esas dos
 * variantes se resuelven acotadas (ultimas TOPE_ESCANEO filas) y se avisa en la UI.
 */
export type OrdenDonaciones = 'fecha' | 'monto' | 'estado'

export type ConsultaDonaciones = Readonly<{
  estado?: string | undefined
  linea?: string | undefined
  q?: string | undefined
  /** AAAA-MM-DD, dia calendario de Colombia. */
  desde?: string | undefined
  hasta?: string | undefined
  minPesos?: number | undefined
  maxPesos?: number | undefined
  orden: OrdenDonaciones
  dir: 'asc' | 'desc'
  cursor?: string | undefined
  /** Solo en modo acotado (empieza en 1). */
  pagina: number
  limite: number
}>

export type ResultadoConsulta = Readonly<{
  filas: readonly DonacionFilaVM[]
  total: number
  siguienteCursor: string | null
  /** 'cursor' = paginacion nativa; 'acotado' = orden/monto sobre las ultimas filas. */
  modo: 'cursor' | 'acotado'
  hayMas: boolean
  truncado: boolean
}>

type Listar = (filtros: unknown, paginacion: unknown, actor: Actor) => Promise<Pagina<Donacion>>

export const TOPE_ESCANEO = 1000
const LOTE = 100

function filtrosDominio(c: ConsultaDonaciones): Record<string, unknown> {
  return {
    ...(c.estado ? { estado: c.estado } : {}),
    ...(c.linea ? { linea: c.linea } : {}),
    ...(c.q ? { q: c.q } : {}),
    ...(c.desde ? { desde: new Date(`${c.desde}T00:00:00-05:00`) } : {}),
    ...(c.hasta ? { hasta: new Date(`${c.hasta}T23:59:59.999-05:00`) } : {}),
  }
}

export const esModoNativo = (c: ConsultaDonaciones) =>
  c.minPesos === undefined && c.maxPesos === undefined && c.orden === 'fecha' && c.dir === 'desc'

async function escanear(listar: Listar, actor: Actor, c: ConsultaDonaciones, tope: number) {
  const filas: DonacionFilaVM[] = []
  let cursor: string | undefined
  let truncado = false
  while (filas.length < tope) {
    const pagina = await listar(filtrosDominio(c), { limite: LOTE, ...(cursor ? { cursor } : {}) }, actor)
    filas.push(...pagina.elementos.map(aFilaDonacion))
    if (!pagina.cursorSiguiente) break
    cursor = pagina.cursorSiguiente
    if (filas.length >= tope) truncado = true
  }
  return { filas: filas.slice(0, tope), truncado }
}

function ordenar(filas: DonacionFilaVM[], c: ConsultaDonaciones): DonacionFilaVM[] {
  const signo = c.dir === 'asc' ? 1 : -1
  const clave = (f: DonacionFilaVM): number | string =>
    c.orden === 'monto' ? f.montoPesos : c.orden === 'estado' ? f.estado : f.creadaEn
  return filas.sort((a, b) => {
    const x = clave(a)
    const y = clave(b)
    return (x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1) * signo
  })
}

function filtrarMonto(filas: readonly DonacionFilaVM[], c: ConsultaDonaciones): DonacionFilaVM[] {
  return filas.filter(
    (f) => (c.minPesos === undefined || f.montoPesos >= c.minPesos) && (c.maxPesos === undefined || f.montoPesos <= c.maxPesos),
  )
}

/** Una pagina del listado (la usa la pagina del panel). */
export async function consultarDonaciones(listar: Listar, actor: Actor, c: ConsultaDonaciones): Promise<ResultadoConsulta> {
  if (esModoNativo(c)) {
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
  const { filas, truncado } = await escanear(listar, actor, c, TOPE_ESCANEO)
  const ordenadas = ordenar(filtrarMonto(filas, c), c)
  const inicio = (c.pagina - 1) * c.limite
  return {
    filas: ordenadas.slice(inicio, inicio + c.limite),
    total: ordenadas.length,
    siguienteCursor: null,
    modo: 'acotado',
    hayMas: inicio + c.limite < ordenadas.length,
    truncado,
  }
}

/** Todo lo filtrado (hasta `tope`) para exportar. */
export async function consultarParaExportar(listar: Listar, actor: Actor, c: ConsultaDonaciones, tope = 5000) {
  const { filas, truncado } = await escanear(listar, actor, c, tope)
  return { filas: ordenar(filtrarMonto(filas, c), c), truncado }
}
