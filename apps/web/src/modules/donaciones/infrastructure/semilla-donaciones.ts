/*
 * ════════════════════════════════════════════════════════════════════════
 *  DATOS DE DEMOSTRACIÓN — FICTICIOS. No son donaciones reales de la
 *  Fundación Proinserco. Solo se cargan con ADAPTADORES=memoria.
 * ════════════════════════════════════════════════════════════════════════
 */

import { importeDesdePesos } from '@/shared/domain/importe'
import type { AleatorioDeterminista } from '@/shared/infrastructure/aleatorio-determinista'
import type { EstadoCargo } from '../application/ports/pasarela-pagos'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'
import { Donacion, type DonacionId } from '../domain/donacion'
import type { EstadoDonacion } from '../domain/estado-donacion'
import type { LineaApoyo } from '../domain/linea-apoyo'
import type { PasarelaSimulada } from './pasarela-simulada'

export type DonanteSemilla = Readonly<{ id: string; nombres: string; apellidos: string; correo: string }>

/** 40 donaciones: el reparto imita un mes normal con algo de ruido. */
const ESTADOS: readonly EstadoDonacion[] = [
  ...Array<EstadoDonacion>(24).fill('aprobada'),
  ...Array<EstadoDonacion>(5).fill('pendiente'),
  ...Array<EstadoDonacion>(5).fill('rechazada'),
  ...Array<EstadoDonacion>(3).fill('expirada'),
  'reembolsada',
  'contracargo',
  'creada',
]

const MONTOS = [20_000, 30_000, 50_000, 50_000, 80_000, 100_000, 100_000, 150_000, 200_000, 500_000] as const
const LINEAS: readonly LineaApoyo[] = ['donde-mas-se-necesite', 'donde-mas-se-necesite', 'educacion', 'salud', 'agricola']

const ESTADO_CARGO: Readonly<Record<EstadoDonacion, EstadoCargo | null>> = {
  creada: null,
  pendiente: 'pendiente',
  aprobada: 'aprobado',
  rechazada: 'rechazado',
  expirada: 'expirado',
  reembolsada: 'reembolsado',
  contracargo: 'contracargo',
}

/** Camino de estados desde `creada` hasta el estado final de la semilla. */
function camino(final: EstadoDonacion): EstadoDonacion[] {
  if (final === 'creada') return []
  if (final === 'pendiente') return ['pendiente']
  if (final === 'reembolsada' || final === 'contracargo') return ['pendiente', 'aprobada', final]
  return ['pendiente', final]
}

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export async function sembrarDonaciones(deps: {
  repositorio: RepositorioDonaciones
  pasarela: PasarelaSimulada
  donantes: readonly DonanteSemilla[]
  aleatorio: AleatorioDeterminista
  ahora: Date
}): Promise<void> {
  const { aleatorio } = deps
  for (const [i, final] of ESTADOS.entries()) {
    const donante = deps.donantes[i % deps.donantes.length]
    if (!donante) return
    // Repartidas en los últimos 60 días; las pendientes y la creada son recientes.
    const diasAtras = final === 'pendiente' || final === 'creada' ? aleatorio.entero(0, 1) : aleatorio.entero(0, 59)
    const creadaEn = new Date(deps.ahora.getTime() - diasAtras * 86_400_000 - aleatorio.entero(0, 86_000) * 1000)
    const referencia = `DON-${Array.from({ length: 21 }, () => aleatorio.elegir([...ALFABETO])).join('')}`
    const sufijo = String(i + 1).padStart(12, '0')

    let donacion = Donacion.crear(
      {
        id: `00000000-0000-4000-8000-${sufijo}` as DonacionId,
        referencia,
        claveIdempotencia: `00000000-0000-4000-9000-${sufijo}`,
        importe: importeDesdePesos(aleatorio.elegir(MONTOS)),
        linea: aleatorio.elegir(LINEAS),
        donanteId: donante.id,
        pagador: { nombres: donante.nombres, apellidos: donante.apellidos, correo: donante.correo },
        quiereCertificado: aleatorio.siguiente() < 0.4,
      },
      creadaEn,
    )
    const idCargo = `sim_semilla_${sufijo}`
    let momento = creadaEn.getTime()
    for (const paso of camino(final)) {
      momento += aleatorio.entero(30, 600) * 1000
      const cambios = paso === 'pendiente' ? { idCargo, urlPago: null } : { metodoPago: 'tarjeta-simulada' }
      donacion = donacion.transicionar(paso, new Date(momento), paso === 'pendiente' ? 'servidor' : 'webhook', cambios)
    }
    await deps.repositorio.insertar(donacion)

    const estadoCargo = ESTADO_CARGO[final]
    if (estadoCargo) {
      deps.pasarela.sembrar({
        idCargo,
        referencia,
        importe: donacion.datos.importe,
        estado: estadoCargo,
        metodoPago: donacion.datos.metodoPago,
      })
    }
  }
}
