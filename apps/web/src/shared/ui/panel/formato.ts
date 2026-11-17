/** Formato de fechas y numeros del panel: es-CO, zona horaria de Colombia. */
export const ZONA = 'America/Bogota'

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA })
const FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: ZONA })
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: ZONA })
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA })
const FECHA_COMPLETA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONA,
})
const NUMERO = new Intl.NumberFormat('es-CO')
const PORCENTAJE = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 })

export const formatearFechaHora = (iso: string) => FECHA_HORA.format(new Date(iso))
export const formatearFecha = (iso: string) => FECHA.format(new Date(iso))
export const formatearFechaCorta = (iso: string) => FECHA_CORTA.format(new Date(iso))
export const formatearFechaLarga = (iso: string) => FECHA_LARGA.format(new Date(iso))
/** "lunes, 16 de noviembre de 2026, 2:32 p. m." — la versión accesible de cualquier fecha diseñada. */
export const formatearFechaCompleta = (iso: string) => FECHA_COMPLETA.format(new Date(iso))
export const formatearNumero = (n: number) => NUMERO.format(n)
export const formatearPorcentaje = (fraccion: number) => PORCENTAJE.format(fraccion)

/** Compacta importes grandes para ejes de grafica: 1,2 M / 350 mil. */
export function formatearCompacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString('es-CO')} mil`
  return String(n)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const

export const nombreMes = (mes0: number) => MESES_LARGOS[mes0] ?? ''
export const nombreMesCorto = (mes0: number) => MESES[mes0] ?? ''

const PARTES = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
  timeZone: ZONA,
})
const DIA_SEMANA: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export type PartesFecha = Readonly<{
  anio: number
  mes0: number
  dia: number
  hora: string
  /** "nov" */
  mes: string
  /** "lunes" */
  diaSemana: string
}>

/** Descompone un instante en sus partes en hora de Colombia (para los componentes de fecha). */
export function partesFecha(iso: string): PartesFecha {
  const p = Object.fromEntries(PARTES.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const mes0 = Number(p.month) - 1
  return {
    anio: Number(p.year),
    mes0,
    dia: Number(p.day),
    hora: `${p.hour}:${p.minute}`,
    mes: nombreMesCorto(mes0),
    diaSemana: DIAS[DIA_SEMANA[p.weekday ?? 'Sun'] ?? 0] ?? '',
  }
}

/** Partes de una fecha de calendario "AAAA-MM-DD" (sin zona: es un día, no un instante). */
export function partesDia(ymd: string): PartesFecha {
  const [a = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return { anio: a, mes0: m - 1, dia: d, hora: '', mes: nombreMesCorto(m - 1), diaSemana: DIAS[dow] ?? '' }
}

const RELATIVO = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto', style: 'long' })

/** "hace 3 horas", "ayer", "hace 2 semanas". `ahora` lo fija quien renderiza (servidor). */
export function formatearRelativo(iso: string, ahora: Date): string {
  const seg = (new Date(iso).getTime() - ahora.getTime()) / 1000
  const abs = Math.abs(seg)
  if (abs < 45) return 'hace un momento'
  if (abs < 3600) return RELATIVO.format(Math.round(seg / 60), 'minute')
  if (abs < 86_400) return RELATIVO.format(Math.round(seg / 3600), 'hour')
  if (abs < 7 * 86_400) return RELATIVO.format(Math.round(seg / 86_400), 'day')
  if (abs < 45 * 86_400) return RELATIVO.format(Math.round(seg / (7 * 86_400)), 'week')
  return RELATIVO.format(Math.round(seg / (30 * 86_400)), 'month')
}

/** Separa "$ 1.040.000" en símbolo y cifra (COP sin decimales). */
export function partesPesos(pesos: number): Readonly<{ signo: string; cifra: string }> {
  return { signo: pesos < 0 ? '−' : '', cifra: NUMERO.format(Math.abs(Math.round(pesos))) }
}

/** Iniciales para avatares: "Ana María Pérez" → "AM". */
export const iniciales = (nombre: string) =>
  nombre
    .replace(/[^\p{L}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
