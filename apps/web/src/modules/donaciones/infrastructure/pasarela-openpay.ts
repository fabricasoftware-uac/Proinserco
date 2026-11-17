import { NoImplementado } from '@/shared/domain/errores'
import type { PasarelaPagos } from '../application/ports/pasarela-pagos'

export type ConfiguracionOpenpay = Readonly<{
  merchantId: string
  /** Llave PRIVADA. Solo servidor. Nunca en logs, nunca con NEXT_PUBLIC_. */
  llavePrivada: string
  /** https://sandbox-api.openpay.co o https://api.openpay.co (env.ts impide mezclarlas). */
  urlApi: string
}>

/**
 * ESQUELETO — Adaptador real de Openpay Colombia (checkout hospedado / redirect).
 * Referencia: vault `03 - Seguridad/Pagos en Línea y Pasarelas.md` → "Openpay Colombia".
 *
 * SALOMÓN: qué debe hacer, sin saltarse ningún control:
 *
 * crearCargo(solicitud)
 *  - POST {urlApi}/v1/{merchantId}/charges con Basic auth (usuario = llave privada,
 *    contraseña vacía). `fetch` propio con `AbortSignal.timeout(10_000)`; el SDK
 *    `openpay` de npm NO se mantiene: no usarlo.
 *  - Cuerpo: { method: 'card', amount, currency: 'COP', description,
 *    order_id: solicitud.referencia, confirm: false, send_email: false,
 *    redirect_url: solicitud.urlRetorno, customer: { name, last_name, email } }.
 *  - `amount`: VERIFICAR con Openpay el formato para COP (¿entero en pesos? ¿decimales?).
 *    La conversión desde `importe.centavos` vive SOLO aquí y lleva test.
 *  - `order_id` = nuestra referencia (UNIQUE en BD): es la idempotencia propia aunque
 *    Openpay no garantice rechazar un segundo cargo con el mismo order_id (VERIFICAR).
 *  - Respuesta esperada: status `charge_pending` + `payment_method.url`. Validarla con
 *    Zod; devolver { idCargo: id, urlPago: payment_method.url }. Comprobar que la URL
 *    es https y de un host de Openpay (lista blanca) antes de devolverla: nuestro
 *    servidor redirige ahí. Cuando se conozca el host del checkout, añadirlo a
 *    `form-action` de la CSP (src/server/csp.ts).
 *  - Errores: HTTP 402 + error_code 3005 = rechazo antifraude. Mapear a errores de
 *    dominio; NUNCA registrar el cuerpo de la petición ni la cabecera Authorization.
 *
 * consultarCargo(idCargo)
 *  - GET {urlApi}/v1/{merchantId}/charges/{idCargo} con la llave privada. ES LA FUENTE
 *    DE VERDAD: el webhook no trae firma HMAC, así que nunca se confía en su cuerpo,
 *    ni en los parámetros que Openpay añade a la URL de retorno.
 *  - Traducir status: completed → aprobado, failed/cancelled → rechazado,
 *    expired → expirado, refunded → reembolsado, chargeback_* → contracargo,
 *    in_progress/charge_pending → pendiente. VERIFICAR la lista exacta de estados.
 *  - Devolver importe y moneda TAL COMO los reporta Openpay: el caso de uso
 *    `conciliarDonacion` los compara con los nuestros y no aprueba si no coinciden.
 *  - Guardar solo método, últimos 4 y marca si vienen. Jamás PAN, CVV ni vencimiento.
 */
export function crearPasarelaOpenpay(_configuracion: ConfiguracionOpenpay): PasarelaPagos {
  return {
    async crearCargo() {
      throw new NoImplementado('PasarelaPagos.crearCargo (Openpay)')
    },
    async consultarCargo() {
      throw new NoImplementado('PasarelaPagos.consultarCargo (Openpay)')
    },
  }
}
