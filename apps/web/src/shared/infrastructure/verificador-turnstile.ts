import { z } from 'zod'
import type { VerificadorAntiBots } from '../application/ports/verificador-anti-bots'

const RespuestaSiteverify = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
})

type Opciones = {
  secreto: string
  hostnameEsperado: string
  /** Si se usa `action` en el widget, se exige aquí. */
  accionEsperada?: string
  alFallar?: (motivo: string) => void
}

const URL_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Cloudflare Turnstile verificado en servidor.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 * Token de un solo uso, válido 300 s. Falla cerrado ante cualquier anomalía.
 */
export function crearVerificadorTurnstile(opciones: Opciones): VerificadorAntiBots {
  return {
    async verificar(token, ip) {
      if (!token || token.length > 2048) return false
      try {
        const cuerpo = new URLSearchParams({ secret: opciones.secreto, response: token })
        if (ip && ip !== 'desconocida') cuerpo.set('remoteip', ip)
        const r = await fetch(URL_SITEVERIFY, { method: 'POST', body: cuerpo, signal: AbortSignal.timeout(5_000) })
        if (!r.ok) {
          opciones.alFallar?.(`siteverify HTTP ${r.status}`)
          return false
        }
        const datos = RespuestaSiteverify.safeParse(await r.json())
        if (!datos.success) return false
        if (!datos.data.success) return false
        if (datos.data.hostname !== opciones.hostnameEsperado) return false
        if (opciones.accionEsperada && datos.data.action !== opciones.accionEsperada) return false
        return true
      } catch (error) {
        opciones.alFallar?.(error instanceof Error ? error.name : 'desconocido')
        return false
      }
    },
  }
}
