import { paginarDescendente } from '@/shared/domain/paginacion'
import type { RegistroConsentimientos } from '../application/ports/registro-consentimientos'
import type { RepositorioDonantes } from '../application/ports/repositorio-donantes'
import type { Consentimiento } from '../domain/consentimiento'
import type { Donante } from '../domain/donante'

/** Adaptador EN MEMORIA del repositorio de donantes (demo y tests). */
export function crearRepositorioDonantesMemoria(): RepositorioDonantes {
  const filas = new Map<string, Donante>()
  return {
    async guardar(donante) {
      filas.set(donante.id, Object.freeze({ ...donante }))
    },
    async buscarPorId(id) {
      return filas.get(id) ?? null
    },
    async buscarPorDocumento(tipo, numero) {
      for (const d of filas.values()) if (d.tipoDocumento === tipo && d.numeroDocumento === numero) return d
      return null
    },
    async listar(filtros, paginacion) {
      const q = filtros.q?.toLowerCase()
      const lista = [...filas.values()]
        .filter((d) => !q || `${d.nombres} ${d.apellidos} ${d.correo}`.toLowerCase().includes(q))
        .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime() || (b.id < a.id ? -1 : 1))
      return paginarDescendente(lista, (d) => ({ en: d.creadoEn.toISOString(), id: d.id }), paginacion)
    },
    async contar() {
      return filas.size
    },
  }
}

/** Registro de consentimientos EN MEMORIA. Solo inserción: no expone nada para editar. */
export function crearRegistroConsentimientosMemoria(): RegistroConsentimientos {
  const filas: Consentimiento[] = []
  return {
    async insertar(consentimiento) {
      filas.push(Object.freeze({ ...consentimiento }))
    },
    async listarPorDonante(donanteId) {
      return filas.filter((c) => c.donanteId === donanteId)
    },
  }
}
