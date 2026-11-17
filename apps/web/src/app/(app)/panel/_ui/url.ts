/** Utilidades de URL para listados con estado en la barra de direcciones. */

export type ParamsCrudos = Record<string, string | string[] | undefined>

/** Primer valor de cada parámetro; los vacíos se descartan (un formulario GET envía `min=`). */
export function normalizarParametros(crudos: ParamsCrudos): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(crudos)) {
    const v = Array.isArray(valor) ? valor[0] : valor
    if (typeof v === 'string' && v.trim() !== '') salida[clave] = v
  }
  return salida
}

/** Construye `base?a=1&b=2` omitiendo vacíos. */
export function construirHref(base: string, params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') q.set(clave, String(valor))
  }
  const texto = q.toString()
  return texto ? `${base}?${texto}` : base
}
