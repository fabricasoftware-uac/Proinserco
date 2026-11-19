import type { Auditor } from '@/shared/application/ports/auditor'
import type { Notificador, SeveridadAlerta } from '@/shared/application/ports/notificador'
import type { Reloj } from '@/shared/application/ports/reloj'
import { ACTOR_SISTEMA } from '@/shared/domain/actor'
import { LIMITE_MAXIMO } from '@/shared/domain/paginacion'
import type { Donacion } from '../../domain/donacion'
import { ReferenciaDonacion } from '../../domain/esquemas'
import type { EstadoDonacion } from '../../domain/estado-donacion'
import type { CargoConsultado, PasarelaPagos } from '../ports/pasarela-pagos'
import type { RepositorioDonaciones } from '../ports/repositorio-donaciones'
import type { crearConciliarDonacion } from './conciliar-donacion'

const MINUTOS_ABANDONO_CREADAS_DEFECTO = 60
const MINUTOS_GRACIA_PENDIENTES_DEFECTO = 15
const HORAS_CRUCE_DEFECTO = 48
const MS_POR_MINUTO = 60_000
const ESTADOS_YA_APROBADOS: ReadonlySet<EstadoDonacion> = new Set(['aprobada', 'reembolsada', 'contracargo'])

export type ResumenConciliacionPendientes = Readonly<{
  revisadas: number
  actualizadas: number
  expiradas: number
  discrepancias: number
  errores: number
  /** Cargos aprobados en la pasarela cotejados con nuestra base (cruce diario). */
  cargosCruzados: number
}>

export type OpcionesConciliacionPendientes = Readonly<{
  minutosAbandonoCreadas?: number | undefined
  minutosGraciaPendientes?: number | undefined
  /** Ventana del cruce con el listado de cargos de la pasarela (por defecto 48 h: ayer y hoy). */
  horasCruce?: number | undefined
}>

type Dependencias = {
  donaciones: RepositorioDonaciones
  conciliar: ReturnType<typeof crearConciliarDonacion>
  /** Solo para el cruce con el listado de cargos (lectura). Los cambios pasan por `conciliar`. */
  pasarela: Pick<PasarelaPagos, 'listarCargos'>
  reloj: Reloj
  auditor: Auditor
  notificador: Notificador
}

type Contadores = {
  revisadas: number
  actualizadas: number
  expiradas: number
  discrepancias: number
  errores: number
  cargosCruzados: number
}

/**
 * Conciliación diaria (Handoff 7.7):
 *  1. Donaciones `pendiente` (y `creada` con cargo) → consulta autoritativa a la pasarela.
 *  2. `creada` SIN cargo y abandonadas → antes de expirarlas se busca el cargo en la
 *     pasarela por referencia (`order_id`): si existe, se aplica su estado real.
 *  3. Cruce con el listado de cargos de la pasarela: un cargo APROBADO allí que en
 *     nuestra base no figura como aprobado se intenta conciliar y, si no se puede,
 *     queda como discrepancia auditada. Nunca se "corrige" a ciegas.
 *  4. Si hubo discrepancias o errores: evento de auditoría `conciliacion.alerta`
 *     con severidad y aviso por el puerto `Notificador`.
 */
export function crearConciliarPendientes(deps: Dependencias) {
  return async function conciliarPendientes(
    opciones: OpcionesConciliacionPendientes = {},
  ): Promise<ResumenConciliacionPendientes> {
    const minutosAbandono = opciones.minutosAbandonoCreadas ?? MINUTOS_ABANDONO_CREADAS_DEFECTO
    const minutosGracia = opciones.minutosGraciaPendientes ?? MINUTOS_GRACIA_PENDIENTES_DEFECTO
    const horasCruce = opciones.horasCruce ?? HORAS_CRUCE_DEFECTO
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
      cargosCruzados: 0,
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
        await resolverCreadaAbandonada(deps, donacion, contadores)
        return
      }
      if (donacion.datos.creadaEn > cortePendientes) return
      procesadas.add(donacion.id)
      await conciliarIndividual(deps, donacion, contadores)
    })

    await cruzarConCargosDeLaPasarela(
      deps,
      { desde: new Date(ahora.getTime() - horasCruce * 3_600_000), hasta: ahora },
      contadores,
    )

    const resumen: ResumenConciliacionPendientes = { ...contadores }
    if (resumen.discrepancias > 0 || resumen.errores > 0) await alertar(deps, resumen)
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

/**
 * `creada` sin cargo y abandonada. Antes de expirarla se pregunta a la pasarela por
 * nuestra referencia: pudo crearse el cargo y fallar el guardado del `idCargo`.
 * Si la pasarela no responde NO se expira (se reintentará en la próxima corrida).
 */
async function resolverCreadaAbandonada(deps: Dependencias, donacion: Donacion, contadores: Contadores): Promise<void> {
  contadores.revisadas += 1
  try {
    const resultado = await deps.conciliar({ referencia: donacion.datos.referencia }, 'conciliacion')
    if (resultado.resultado !== 'sin_cargo') {
      contarResultado(resultado.resultado, contadores)
      return
    }
    const expirada = donacion.transicionar('expirada', deps.reloj.ahora(), 'conciliacion')
    const guardada = await deps.donaciones.actualizarSiEstado(expirada, 'creada')
    if (!guardada) return
    await deps.auditor.registrar({
      accion: 'donacion.transicion',
      actorId: ACTOR_SISTEMA,
      recurso: 'donacion',
      recursoId: donacion.id,
      ip: null,
      detalles: { desde: 'creada', hacia: 'expirada', aplicada: true, motivo: 'sin_cargo_en_pasarela' },
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
    contarResultado(resultado.resultado, contadores)
  } catch {
    contadores.errores += 1
  }
}

function contarResultado(resultado: Awaited<ReturnType<Dependencias['conciliar']>>['resultado'], contadores: Contadores) {
  switch (resultado) {
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
}

/** Handoff 7.7, punto 2: cargos aprobados en la pasarela que aquí no figuran como aprobados. */
async function cruzarConCargosDeLaPasarela(
  deps: Dependencias,
  rango: Readonly<{ desde: Date; hasta: Date }>,
  contadores: Contadores,
): Promise<void> {
  let cargos: readonly CargoConsultado[]
  try {
    cargos = await deps.pasarela.listarCargos(rango)
  } catch {
    contadores.errores += 1
    return
  }

  for (const cargo of cargos) {
    if (cargo.estado !== 'aprobado') continue
    contadores.cargosCruzados += 1
    try {
      const donacion = await buscarDonacionDeCargo(deps.donaciones, cargo)
      if (!donacion) {
        await auditarCargoSinReflejo(deps, cargo, null, 'aprobado_sin_donacion')
        contadores.discrepancias += 1
        continue
      }
      if (ESTADOS_YA_APROBADOS.has(donacion.estado)) continue

      const resultado = await deps.conciliar(
        { idCargo: cargo.idCargo, referenciaRespaldo: donacion.datos.referencia },
        'conciliacion',
      )
      if (resultado.resultado === 'actualizada' && ESTADOS_YA_APROBADOS.has(resultado.estado)) {
        contadores.actualizadas += 1
        continue
      }
      contadores.discrepancias += 1
      // `conciliar` ya audita las discrepancias de referencia/importe/moneda.
      if (resultado.resultado !== 'discrepancia') await auditarCargoSinReflejo(deps, cargo, donacion, 'aprobado_no_reflejado')
    } catch {
      contadores.errores += 1
    }
  }
}

async function buscarDonacionDeCargo(donaciones: RepositorioDonaciones, cargo: CargoConsultado): Promise<Donacion | null> {
  const porCargo = await donaciones.buscarPorIdCargo(cargo.idCargo)
  if (porCargo) return porCargo
  return ReferenciaDonacion.safeParse(cargo.referencia).success ? donaciones.buscarPorReferencia(cargo.referencia) : null
}

async function auditarCargoSinReflejo(
  deps: Dependencias,
  cargo: CargoConsultado,
  donacion: Donacion | null,
  motivo: 'aprobado_sin_donacion' | 'aprobado_no_reflejado',
): Promise<void> {
  await deps.auditor.registrar({
    accion: 'donacion.discrepancia',
    actorId: ACTOR_SISTEMA,
    recurso: donacion ? 'donacion' : 'cargo_pasarela',
    recursoId: donacion ? donacion.id : cargo.idCargo.slice(0, 120),
    ip: null,
    detalles: {
      motivo,
      estadoLocal: donacion?.estado ?? null,
      estadoPasarela: cargo.estado,
      referenciaPasarela: cargo.referencia.slice(0, 60),
      severidad: 'alta',
    },
  })
}

async function alertar(deps: Dependencias, resumen: ResumenConciliacionPendientes): Promise<void> {
  const severidad: SeveridadAlerta = resumen.discrepancias > 0 ? 'critica' : 'advertencia'
  let auditada = true
  try {
    await deps.auditor.registrar({
      accion: 'conciliacion.alerta',
      actorId: ACTOR_SISTEMA,
      recurso: 'conciliacion',
      recursoId: null,
      ip: null,
      detalles: { severidad, ...resumen },
    })
  } catch {
    auditada = false
  }
  // La notificación sale aunque falle la auditoría (p. ej. base de datos caída).
  await deps.notificador.notificar({
    titulo: 'Conciliación diaria con discrepancias o errores',
    severidad,
    detalles: { ...resumen, auditada },
  })
}
