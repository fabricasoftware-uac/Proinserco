/**
 * CSV seguro para abrir en hojas de calculo. Una celda que empiece por
 * `=`, `+`, `-`, `@` (o tabulador / retorno) se interpretaria como FORMULA:
 * se le antepone `'` para que se lea como texto (inyeccion de formulas).
 */
const PELIGROSOS = /^[=+\-@\t\r]/

type Celda = string | number | boolean | null | undefined

export function celdaCsv(valor: Celda): string {
  if (valor === null || valor === undefined) return ''
  let texto = String(valor)
  if (PELIGROSOS.test(texto)) texto = `'${texto}`
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

export function filaCsv(celdas: readonly Celda[]): string {
  return celdas.map(celdaCsv).join(',')
}

/** BOM UTF-8 al inicio: Excel respeta las tildes. Saltos CRLF segun RFC 4180. */
export function documentoCsv(encabezados: readonly string[], filas: readonly (readonly Celda[])[]): string {
  return `﻿${[filaCsv(encabezados), ...filas.map(filaCsv)].join('\r\n')}\r\n`
}
