import { z } from 'zod'
import type { Actor } from '@/shared/domain/actor'
import { type Pagina, Paginacion } from '@/shared/domain/paginacion'
import type { Donante } from '../../domain/donante'
import type { RepositorioDonantes } from '../ports/repositorio-donantes'

type Dependencias = { donantes: RepositorioDonantes }

export const FiltrosDonantes = z.object({ q: z.string().trim().min(2).max(100).optional().catch(undefined) })

export function crearListarDonantes(deps: Dependencias) {
  return async function listarDonantes(filtros: unknown, paginacion: unknown, actor: Actor): Promise<Pagina<Donante>> {
    actor.exigir('donantes:leer')
    return deps.donantes.listar(FiltrosDonantes.parse(filtros ?? {}), Paginacion.parse(paginacion ?? {}))
  }
}

export function crearContarDonantes(deps: Dependencias) {
  return async function contarDonantes(actor: Actor): Promise<number> {
    actor.exigir('donantes:leer')
    return deps.donantes.contar()
  }
}
