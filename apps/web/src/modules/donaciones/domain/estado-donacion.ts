import { z } from 'zod'

/**
 * Máquina de estados de la donación (especificación + vault de pagos):
 *
 *   creada ──► pendiente ──► aprobada ──► reembolsada
 *      │           │             └──────► contracargo
 *      │           ├──► rechazada
 *      │           └──► expirada
 *      └────────► expirada
 *
 * Las transiciones solo ocurren en servidor y nunca a partir de un estado
 * enviado por el navegador.
 */
export const EstadoDonacion = z.enum(['creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo'])
export type EstadoDonacion = z.infer<typeof EstadoDonacion>

export const TRANSICIONES: Readonly<Record<EstadoDonacion, readonly EstadoDonacion[]>> = {
  creada: ['pendiente', 'expirada'],
  pendiente: ['aprobada', 'rechazada', 'expirada'],
  aprobada: ['reembolsada', 'contracargo'],
  rechazada: [],
  expirada: [],
  reembolsada: [],
  contracargo: [],
}

export function esTransicionValida(desde: EstadoDonacion, hacia: EstadoDonacion): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

export function esEstadoFinal(estado: EstadoDonacion): boolean {
  return TRANSICIONES[estado].length === 0
}

/** Quién provocó una transición. Queda en el historial y en la auditoría. */
export const OrigenTransicion = z.enum(['servidor', 'conciliacion', 'webhook', 'panel'])
export type OrigenTransicion = z.infer<typeof OrigenTransicion>
