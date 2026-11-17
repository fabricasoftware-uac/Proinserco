import type { Importe } from '@/shared/domain/importe'

/** Estado de un cargo según la PASARELA (fuente de verdad), ya traducido por el adaptador. */
export type EstadoCargo = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'reembolsado' | 'contracargo'

export type CargoConsultado = Readonly<{
  idCargo: string
  /** Nuestra referencia, tal como la devuelve la pasarela (order_id). */
  referencia: string
  estado: EstadoCargo
  importe: Importe
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
}
