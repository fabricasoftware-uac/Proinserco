export type ResultadoLimite = Readonly<{
  permitido: boolean
  restantes: number
  reintentarEnSegundos: number
}>

/**
 * Limitador de tasa con ventana fija. Con más de una instancia de la app
 * necesita almacén compartido (Redis): un contador en memoria por instancia
 * multiplica el límite real por el número de instancias.
 */
export interface LimitadorDeTasa {
  consumir(clave: string, limite: number, ventanaSegundos: number): Promise<ResultadoLimite>
}
