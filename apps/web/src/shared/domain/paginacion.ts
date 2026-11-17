import { z } from 'zod'

export const LIMITE_POR_DEFECTO = 20
export const LIMITE_MAXIMO = 100

/** Entrada de paginación por cursor. El límite fuera de rango se recorta, no falla. */
export const Paginacion = z.object({
  limite: z.coerce
    .number()
    .int()
    .catch(LIMITE_POR_DEFECTO)
    .transform((n) => Math.min(Math.max(n, 1), LIMITE_MAXIMO))
    .default(LIMITE_POR_DEFECTO),
  cursor: z.string().max(200).optional(),
})
export type Paginacion = z.infer<typeof Paginacion>

export type Pagina<T> = Readonly<{
  elementos: readonly T[]
  /** Opaco para el cliente. `null` si no hay más. */
  cursorSiguiente: string | null
  total: number
}>

/**
 * Cursor opaco: base64url de la clave de orden. Se valida al decodificar;
 * un cursor manipulado se trata como "sin cursor", nunca como error 500.
 */
const ClaveCursor = z.object({ en: z.string().max(40), id: z.string().max(80) })
export type ClaveCursor = z.infer<typeof ClaveCursor>

export function codificarCursor(clave: ClaveCursor): string {
  const json = JSON.stringify(clave)
  return btoa(json).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function decodificarCursor(cursor: string | undefined): ClaveCursor | null {
  if (!cursor) return null
  try {
    const base64 = cursor.replaceAll('-', '+').replaceAll('_', '/')
    const resultado = ClaveCursor.safeParse(JSON.parse(atob(base64)))
    return resultado.success ? resultado.data : null
  } catch {
    // Cursor ilegible = empezar desde el principio. No es un error del sistema.
    return null
  }
}

/**
 * Pagina en memoria una lista ya ordenada de forma descendente por (en, id).
 * Lo usan los adaptadores en memoria; el adaptador SQL hace lo mismo con
 * `WHERE (creado_en, id) < ($1, $2) ORDER BY creado_en DESC, id DESC LIMIT n`.
 */
export function paginarDescendente<T>(ordenados: readonly T[], clave: (e: T) => ClaveCursor, paginacion: Paginacion): Pagina<T> {
  const desde = decodificarCursor(paginacion.cursor)
  const restantes = desde
    ? ordenados.filter((e) => {
        const k = clave(e)
        return k.en < desde.en || (k.en === desde.en && k.id < desde.id)
      })
    : ordenados
  const elementos = restantes.slice(0, paginacion.limite)
  const ultimo = elementos.at(-1)
  const hayMas = restantes.length > elementos.length
  return {
    elementos,
    cursorSiguiente: hayMas && ultimo ? codificarCursor(clave(ultimo)) : null,
    total: ordenados.length,
  }
}
