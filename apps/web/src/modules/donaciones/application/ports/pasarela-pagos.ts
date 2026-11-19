import type { Importe } from '@/shared/domain/importe'

/** Estado de un cargo según la PASARELA (fuente de verdad), ya traducido por el adaptador. */
export type EstadoCargo = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'reembolsado' | 'contracargo'

export type CargoConsultado = Readonly<{
  idCargo: string
  /** Nuestra referencia, tal como la devuelve la pasarela (order_id). */
  referencia: string
  estado: EstadoCargo
  /**
   * Importe tal como lo reporta la pasarela. `null` si reporta una moneda que no
   * manejamos: la conciliación lo trata como DISCREPANCIA (auditada, sin cambiar estado).
   */
  importe: Importe | null
  /** Moneda tal como la reporta la pasarela (ISO 4217, sin validar). */
  monedaReportada: string
  /** Ej. 'tarjeta', 'pse'. Nunca datos de tarjeta. */
  metodoPago: string | null
}>

export type SolicitudCargo = Readonly<{
  referencia: string
  importe: Importe
  descripcion: string
  pagador: Readonly<{ nombres: string; apellidos: string; correo: string }>
  /** URL absoluta a la que la pasarela devuelve al pagador. Volver NO confirma nada. */
  urlRetorno: string
}>

/**
 * Pasarela de pagos con checkout hospedado (redirect). Ningún dato de
 * tarjeta pasa por nuestro código: el pagador paga en la página de la pasarela.
 */
export interface PasarelaPagos {
  /** Crea el cargo y devuelve a dónde redirigir al pagador. */
  crearCargo(solicitud: SolicitudCargo): Promise<{ idCargo: string; urlPago: string }>
  /** Estado REAL del cargo consultado con la llave privada. Lo único que cambia estados. */
  consultarCargo(idCargo: string): Promise<CargoConsultado>
  /**
   * Busca el cargo creado con nuestra referencia (`order_id`). Sirve para recuperar
   * donaciones cuyo cargo se creó pero cuyo `idCargo` no llegó a guardarse. `null` si no existe.
   */
  buscarCargoPorReferencia(referencia: string): Promise<CargoConsultado | null>
  /** Cargos creados en [desde, hasta] (cruce diario con nuestra base). */
  listarCargos(rango: Readonly<{ desde: Date; hasta: Date }>): Promise<readonly CargoConsultado[]>
}
