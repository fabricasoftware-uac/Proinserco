import type { Auditor } from '@/shared/application/ports/auditor'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import { LIMITE_MAXIMO } from '@/shared/domain/paginacion'
import type { Donacion } from '../../domain/donacion'
import type { EstadoDonacion } from '../../domain/estado-donacion'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'
import type { crearConciliarDonacion } from './conciliar-donacion'

const MINUTOS_ABANDONO_CREADAS_DEFECTO = 60
const MINUTOS_GRACIA_PENDIENTES_DEFECTO = 15
const MS_POR_MINUTO = 60_000

export type ResumenConciliacionPendientes = Readonly<{
  revisadas: number
  actualizadas: number
  expiradas: number
  discrepancias: number
  errores: number
}>

export type OpcionesConciliacionPendientes = Readonly<{
  minutosAbandonoCreadas?: number | undefined
  minutosGraciaPendientes?: number | undefined
}>

type Dependencias = {
  donaciones: RepositorioDonaciones
  conciliar: ReturnType<typeof crearConciliarDonacion>
  reloj: Reloj
  auditor: Auditor
  alAlertar?: ((resumen: ResumenConciliacionPendientes) => void | Promise<void>) | undefined
}

type Contadores = {
  revisadas: number
  actualizadas: number
  expiradas: number
  discrepancias: number
  errores: number
}

/**
 * Concilia donaciones abiertas (`pendiente` y `creada` con cargo) contra la
 * pasarela y expira intentos abandonados en estado `creada` sin cargo.
 *
 * Se recorre primero `pendiente` y luego `creada` con paginación por cursor para
 * evitar conciliar dos veces en la misma corrida una donación `creada` con cargo
 * que pase a `pendiente`.
 */
export function crearConciliarPendientes(deps: Dependencias) {
  return async function conciliarPendientes(
    opciones: OpcionesConciliacionPendientes = {},
  ): Promise<ResumenConciliacionPendientes> {
    const minutosAbandono = opciones.minutosAbandonoCreadas ?? MINUTOS_ABANDONO_CREADAS_DEFECTO
    const minutosGracia = opciones.minutosGraciaPendientes ?? MINUTOS_GRACIA_PENDIENTES_DEFECTO
    const ahora = deps.reloj.ahora()
    const corteAbandono = new Date(ahora.getTime() - minutosAbandono * MS_POR_MINUTO)
    const cortePendientes = new Date(ahora.getTime() - minutosGracia * MS_POR_MINUTO)
    const hastaCreadas = new Date(Math.max(corteAbandono.getTime(), cortePendientes.getTime()))

    const contadores: Contadores = {
      revisadas: 0,
      actualizadas: 0,
      expiradas: 0,
      discrepancias: 0,
      errores: 0,
    }
    const procesadas = new Set<string>()

    await recorrerPorEstado(deps.donaciones, 'pendiente', cortePendientes, async (donacion) => {
      if (procesadas.has(donacion.id)) return
      procesadas.add(donacion.id)
      await conciliarIndividual(deps, donacion, contadores)
    })

    await recorrerPorEstado(deps.donaciones, 'creada', hastaCreadas, async (donacion) => {
      if (procesadas.has(donacion.id)) return
      if (!donacion.datos.idCargo) {
        if (donacion.datos.creadaEn > corteAbandono) return
        procesadas.add(donacion.id)
        await expirarCreadaAbandonada(deps, donacion, deps.reloj.ahora(), contadores)
        return
      }
      if (donacion.datos.creadaEn > cortePendientes) return
      procesadas.add(donacion.id)
      await conciliarIndividual(deps, donacion, contadores)
    })

    const resumen: ResumenConciliacionPendientes = { ...contadores }
    if (resumen.discrepancias > 0 || resumen.errores > 0) {
      await deps.alAlertar?.(resumen)
    }
    return resumen
  }
}

async function recorrerPorEstado(
  donaciones: RepositorioDonaciones,
  estado: EstadoDonacion,
  hasta: Date,
  procesar: (donacion: Donacion) => Promise<void>,
): Promise<void> {
  let cursor: string | undefined
  for (;;) {
    const pagina = await donaciones.listar({ estado, hasta, orden: 'fecha', dir: 'asc' }, { limite: LIMITE_MAXIMO, cursor })
    for (const donacion of pagina.elementos) {
      await procesar(donacion)
    }
    if (!pagina.cursorSiguiente || pagina.cursorSiguiente === cursor) break
    cursor = pagina.cursorSiguiente
  }
}

async function expirarCreadaAbandonada(
  deps: Dependencias,
  donacion: Donacion,
  ahora: Date,
  contadores: Contadores,
): Promise<void> {
  contadores.revisadas += 1
  try {
    const expirada = donacion.transicionar('expirada', ahora, 'conciliacion')
    const guardada = await deps.donaciones.actualizarSiEstado(expirada, 'creada')
    if (!guardada) return
    await deps.auditor.registrar({
      accion: 'donacion.transicion',
      actorId: ACTOR_SISTEMA,
      recurso: 'donacion',
      recursoId: donacion.id,
      ip: null,
      detalles: { desde: 'creada', hacia: 'expirada', aplicada: true },
    })
    contadores.expiradas += 1
  } catch {
    contadores.errores += 1
  }
}

async function conciliarIndividual(deps: Dependencias, donacion: Donacion, contadores: Contadores): Promise<void> {
  contadores.revisadas += 1
  try {
    const resultado = await deps.conciliar({ referencia: donacion.datos.referencia }, 'conciliacion')
    switch (resultado.resultado) {
      case 'actualizada':
        contadores.actualizadas += 1
        break
      case 'discrepancia':
        contadores.discrepancias += 1
        break
      case 'transicion_invalida':
        contadores.errores += 1
        break
      case 'sin_cambios':
      case 'no_encontrada':
      case 'sin_cargo':
      case 'carrera_perdida':
        break
    }
  } catch {
    contadores.errores += 1
  }
}
