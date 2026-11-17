export type OpcionesCookie = Readonly<{
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict' | 'lax'
  path: string
  /** Sin valor = cookie de sesión del navegador. */
  maxAgeSegundos?: number
}>

/**
 * Abstracción de las cookies de la petición. Así el IdentityProvider no
 * depende de Next: el servidor la implementa con `cookies()` de next/headers
 * y los tests con un Map. También encaja con @supabase/ssr (getAll/setAll).
 */
export interface AlmacenCookies {
  obtener(nombre: string): string | undefined
  todas(): readonly Readonly<{ nombre: string; valor: string }>[]
  establecer(nombre: string, valor: string, opciones: OpcionesCookie): void
  eliminar(nombre: string): void
}
