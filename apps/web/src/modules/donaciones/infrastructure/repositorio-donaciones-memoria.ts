import type { Reloj } from '@/shared/application/ports/reloj'
import { type ClaveCursor, paginarOrdenado } from '@/shared/domain/paginacion'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'
import { type DatosDonacion, Donacion } from '../domain/donacion'
import type { FiltrosDonaciones } from '../domain/esquemas'

type Orden = NonNullable<FiltrosDonaciones['orden']>
type Dir = NonNullable<FiltrosDonaciones['dir']>

function claveDeOrden(d: DatosDonacion, orden: Orden, dir: Dir): ClaveCursor {
  const en =
    orden === 'monto' ? d.importe.centavos.toString().padStart(20, '0') : orden === 'estado' ? d.estado : d.creadaEn.toISOString()
  return { en, id: d.id, o: `${orden}:${dir}` }
}

function compararClaves(a: ClaveCursor, b: ClaveCursor, dir: Dir): number {
  const cmp = a.en < b.en ? -1 : a.en > b.en ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return dir === 'asc' ? cmp : -cmp
}

/**
 * Adaptador EN MEMORIA (demo y tests). Se pierde al reiniciar el proceso.
 * Guarda copias congeladas para que nadie mute el estado desde fuera.
 */
export function crearRepositorioDonacionesMemoria(reloj: Reloj = { ahora: () => new Date() }): RepositorioDonaciones {
  const filas = new Map<string, DatosDonacion>()
  /** referencia → última consulta a la pasarela reservada (ms). */
  const consultasPasarela = new Map<string, number>()

  const aDominio = (d: DatosDonacion) => Donacion.reconstruir(d)
  const buscar = (predicado: (d: DatosDonacion) => boolean) => {
    for (const d of filas.values()) if (predicado(d)) return aDominio(d)
    return null
  }

  function coincide(d: DatosDonacion, f: FiltrosDonaciones): boolean {
    if (f.estado && d.estado !== f.estado) return false
    if (f.linea && d.linea !== f.linea) return false
    if (f.desde && d.creadaEn < f.desde) return false
    if (f.hasta && d.creadaEn > f.hasta) return false
    if (f.minCentavos !== undefined && d.importe.centavos < f.minCentavos) return false
    if (f.maxCentavos !== undefined && d.importe.centavos > f.maxCentavos) return false
    if (f.q) {
      const q = f.q.toLowerCase()
      if (!d.referencia.toLowerCase().includes(q) && !d.pagador.correo.toLowerCase().includes(q)) return false
    }
    return true
  }

  const ordenadas = (lista: DatosDonacion[]) =>
    lista.sort((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime() || (b.id < a.id ? -1 : 1))

  return {
    async insertar(donacion) {
      const d = donacion.datos
      for (const otra of filas.values()) {
        if (otra.referencia === d.referencia || otra.claveIdempotencia === d.claveIdempotencia) {
          throw new Error('Violación de unicidad en donaciones')
        }
      }
      filas.set(d.id, Object.freeze({ ...d }))
    },
    async actualizarSiEstado(donacion, estadoEsperado) {
      const actual = filas.get(donacion.id)
      if (!actual || actual.estado !== estadoEsperado) return false
      filas.set(donacion.id, Object.freeze({ ...donacion.datos }))
      return true
    },
    async buscarPorId(id) {
      const d = filas.get(id)
      return d ? aDominio(d) : null
    },
    buscarPorReferencia: async (referencia) => buscar((d) => d.referencia === referencia),
    buscarPorIdCargo: async (idCargo) => buscar((d) => d.idCargo === idCargo),
    async buscarIntentoPorClave(clave) {
      for (const d of filas.values()) {
        if (d.claveIdempotencia === clave) {
          return { referencia: d.referencia, estado: d.estado, urlPago: d.estado === 'pendiente' ? d.urlPago : null }
        }
      }
      return null
    },
    async buscarResumenPublico(referencia) {
      for (const d of filas.values()) {
        if (d.referencia === referencia) {
          return {
            referencia: d.referencia,
            estado: d.estado,
            importe: d.importe,
            creadaEn: d.creadaEn,
            quiereCertificado: d.quiereCertificado,
          }
        }
      }
      return null
    },
    async reservarConsultaPasarela(referencia, intervaloSegundos) {
      const d = [...filas.values()].find((f) => f.referencia === referencia)
      if (!d || (d.estado !== 'creada' && d.estado !== 'pendiente')) return false
      const ahora = reloj.ahora().getTime()
      const intervaloMs = Math.min(Math.max(intervaloSegundos, 5), 3600) * 1000
      const ultima = consultasPasarela.get(referencia)
      if (ultima !== undefined && ahora - ultima < intervaloMs) return false
      consultasPasarela.set(referencia, ahora)
      return true
    },
    async listar(filtros, paginacion) {
      const orden: Orden = filtros.orden ?? 'fecha'
      const dir: Dir = filtros.dir ?? 'desc'
      const criterio = `${orden}:${dir}`
      const clave = (d: DatosDonacion) => claveDeOrden(d, orden, dir)
      const lista = [...filas.values()]
        .filter((d) => coincide(d, filtros))
        .sort((a, b) => compararClaves(clave(a), clave(b), dir))
      const pagina = paginarOrdenado(lista, clave, paginacion, dir, criterio)
      return { ...pagina, elementos: pagina.elementos.map(aDominio) }
    },
    async listarDesde(desde) {
      return ordenadas([...filas.values()].filter((d) => d.creadaEn >= desde)).map(aDominio)
    },
  }
}
