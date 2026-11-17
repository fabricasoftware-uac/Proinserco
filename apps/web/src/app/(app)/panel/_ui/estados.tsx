import type { EstadoDonacion, LineaApoyo } from '@/modules/donaciones'
import { Aro, Estado, type FormaAro, type Tono } from '@/shared/ui/panel/aro'

export const ETIQUETA_ESTADO: Readonly<Record<EstadoDonacion, string>> = {
  creada: 'Creada',
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  expirada: 'Expirada',
  reembolsada: 'Reembolsada',
  contracargo: 'Contracargo',
}

export const TONO_ESTADO: Readonly<Record<EstadoDonacion, Tono>> = {
  creada: 'neutro',
  pendiente: 'aviso',
  aprobada: 'ok',
  rechazada: 'malo',
  expirada: 'neutro',
  reembolsada: 'info',
  contracargo: 'contra',
}

/** La familia de aros: cada estado se reconoce por su forma además del color. */
export const FORMA_ESTADO: Readonly<Record<EstadoDonacion, FormaAro>> = {
  creada: 'abierto',
  pendiente: 'girando',
  aprobada: 'cerrado',
  rechazada: 'roto',
  expirada: 'punteado',
  reembolsada: 'invertido',
  contracargo: 'marca',
}

export const ETIQUETA_LINEA: Readonly<Record<LineaApoyo, string>> = {
  'donde-mas-se-necesite': 'Donde más se necesite',
  educacion: 'Educación',
  salud: 'Salud',
  agricola: 'Agrícola',
}

/** Estado de una donación: aro con forma propia + nombre. Igual en tabla, ficha, filtros, leyenda y gráfica. */
export function EstadoDonacionAro({ estado, grande }: { estado: EstadoDonacion; grande?: boolean }) {
  return (
    <Estado tono={TONO_ESTADO[estado]} forma={FORMA_ESTADO[estado]} grande={grande}>
      {ETIQUETA_ESTADO[estado]}
    </Estado>
  )
}

/** Solo el glifo (para ejes, leyendas y móviles); el nombre va al lado o en texto oculto. */
export function AroEstado({ estado, tamano = 18 }: { estado: EstadoDonacion; tamano?: number }) {
  return <Aro forma={FORMA_ESTADO[estado]} tono={TONO_ESTADO[estado]} tamano={tamano} />
}

/** Compatibilidad con el nombre anterior. */
export const InsigniaEstado = EstadoDonacionAro
