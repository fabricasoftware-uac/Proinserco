import { paginarDescendente } from '@/shared/domain/paginacion'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'
import { type DatosDonacion, Donacion } from '../domain/donacion'
import type { FiltrosDonaciones } from '../domain/esquemas'

/**
 * Adaptador EN MEMORIA (demo y tests). Se pierde al reiniciar el proceso.
 * Guarda copias congeladas para que nadie mute el estado desde fuera.
 */
export function crearRepositorioDonacionesMemoria(): RepositorioDonaciones {
  const filas = new Map<string, DatosDonacion>()

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
    buscarPorClaveIdempotencia: async (clave) => buscar((d) => d.claveIdempotencia === clave),
    async listar(filtros, paginacion) {
      const lista = ordenadas([...filas.values()].filter((d) => coincide(d, filtros)))
      const pagina = paginarDescendente(lista, (d) => ({ en: d.creadaEn.toISOString(), id: d.id }), paginacion)
      return { ...pagina, elementos: pagina.elementos.map(aDominio) }
    },
    async listarDesde(desde) {
      return ordenadas([...filas.values()].filter((d) => d.creadaEn >= desde)).map(aDominio)
    },
  }
}
