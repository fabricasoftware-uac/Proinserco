/**
 * Aserción para piezas de DEMOSTRACIÓN (pasarela simulada, usuarios demo): jamás
 * deben instanciarse con `NODE_ENV=production`, ni siquiera en una demo pública
 * autorizada con `ADAPTADORES_MEMORIA_EN_PRODUCCION=si`. Si alguien las cablea por
 * error en producción, el arranque falla en vez de aceptar pagos o accesos falsos.
 */
export function exigirEntornoNoProductivo(pieza: string, nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new Error(`${pieza} es solo para desarrollo y pruebas: prohibida con NODE_ENV=production`)
  }
}
