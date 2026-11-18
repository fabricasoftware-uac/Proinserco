'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { accionPublica, conAntiBots, conLimiteDeTasa } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { FormularioDonacion } from './esquema'

const CorreoSinValidar = z.object({ donante: z.object({ correo: z.string().max(254) }) })

/**
 * Crea la donación y lleva al donante al checkout hospedado de la pasarela.
 * Orden (vault: Pagos + DDoS): límite por IP y por correo → Turnstile →
 * validación Zod → caso de uso (monto validado en servidor, idempotencia).
 * Nunca recibe ni devuelve datos de tarjeta.
 *
 * Uso desde el formulario (cliente):
 *   const { executeAsync, result } = useAction(crearDonacionAccion)
 *   await executeAsync({ montoPesos, linea, claveIdempotencia, donante: {...},
 *                        autorizacionDatos: true, quiereCertificado, tokenAntiBots })
 *   // Éxito: la acción redirige a la URL de pago (no devuelve).
 *   // Error: result.serverError = { codigo, mensaje, requestId }; result.validationErrors.
 */
export const crearDonacionAccion = accionPublica
  .metadata({ nombre: 'crear-donacion' })
  .use(
    conLimiteDeTasa({
      limite: 5,
      ventanaSegundos: 600,
      limiteIdentidad: 3,
      identidad: (entrada) => {
        const r = CorreoSinValidar.safeParse(entrada)
        return r.success ? r.data.donante.correo : null
      },
    }),
  )
  .use(conAntiBots)
  .inputSchema(FormularioDonacion)
  .action(async ({ parsedInput }) => {
    const { ip, userAgent } = await contextoPeticion()
    // Honeypot relleno: se responde como si nada para no dar pistas al bot.
    if (parsedInput.sitioWeb) redirect('/')

    const { donaciones } = await obtenerContenedor()
    const { urlPago } = await ejecutarConContextoDb({ modo: 'publico' }, () =>
      donaciones.crearDonacion({
        donacion: {
          montoPesos: parsedInput.montoPesos,
          linea: parsedInput.linea,
          claveIdempotencia: parsedInput.claveIdempotencia,
        },
        donante: parsedInput.donante,
        quiereCertificado: parsedInput.quiereCertificado,
        contexto: { ip, userAgent },
      }),
    )
    redirect(urlPago)
  })
