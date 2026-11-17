const FORMATO_COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

/** Pesos colombianos sin decimales: `$ 50.000`. */
export function formatearPesos(pesos: number): string {
  return FORMATO_COP.format(pesos)
}
