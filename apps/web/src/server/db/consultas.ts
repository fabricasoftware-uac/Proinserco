import 'server-only'
import { LIMITE_MAXIMO, LIMITE_POR_DEFECTO } from '@/shared/domain/paginacion'

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Valida formato UUID antes de consultar columnas `uuid` (evita SQLSTATE 22P02). */
export function esUuidValido(valor: string): boolean {
  return PATRON_UUID.test(valor)
}

/** Escapa comodines de LIKE/ILIKE (`\`, `%`, `_`) para búsqueda literal. */
export function escaparParaLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)
}

/** Acota `limite` entre 1 y `LIMITE_MAXIMO` para paginación por cursor. */
export function normalizarLimitePaginacion(limite: number | undefined): number {
  if (typeof limite !== 'number' || !Number.isFinite(limite)) return LIMITE_POR_DEFECTO
  return Math.min(Math.max(Math.trunc(limite), 1), LIMITE_MAXIMO)
}

/** Parsea una marca ISO de cursor devolviendo `Date` válida o `null`. */
export function parsearFechaCursor(valor: string): Date | null {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}
