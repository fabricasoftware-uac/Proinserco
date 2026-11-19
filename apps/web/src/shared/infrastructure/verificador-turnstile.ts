import 'server-only'
import { z } from 'zod'
import type { LimitadorDeTasa } from '../application/ports/limitador-de-tasa'
import type { VerificadorAntiBots } from '../application/ports/verificador-anti-bots'

const RespuestaSiteverify = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
})

/** Vida de un token de Turnstile según Cloudflare (300 s). */
const VIDA_TOKEN_SEGUNDOS = 300

type Opciones = {
  secreto: string
  hostnameEsperado: string
  /** Si se usa `action` en el widget, se exige aquí. */
  accionEsperada?: string
  /**
   * Registro de tokens ya presentados (compartido entre instancias si es Redis). Cloudflare
   * ya rechaza un token repetido (`timeout-or-duplicate`), pero así un token no llega dos
   * veces a siteverify ni a la lógica de negocio aunque Cloudflare tarde en marcarlo.
   */
  limitador?: LimitadorDeTasa
  alFallar?: (motivo: string) => void
}

const URL_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Cloudflare Turnstile verificado en servidor.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 * Comprueba `success`, `hostname` (= APP_URL) y `action`; token de un solo uso, válido
 * 300 s. Falla cerrado ante cualquier anomalía (red, timeout, respuesta rara).
 */
export function crearVerificadorTurnstile(opciones: Opciones): VerificadorAntiBots {
  return {
    async verificar(token, ip) {
      if (!token || token.length > 2048) return false
      try {
        if (opciones.limitador) {
          // `:id:` hace que el limitador Redis guarde el token hasheado, nunca en claro.
          const uso = await opciones.limitador.consumir(`turnstile-token:id:${token}`, 1, VIDA_TOKEN_SEGUNDOS)
          if (!uso.permitido) {
            opciones.alFallar?.('token reutilizado')
            return false
          }
        }
        const cuerpo = new URLSearchParams({ secret: opciones.secreto, response: token })
        if (ip && ip !== 'desconocida') cuerpo.set('remoteip', ip)
        const r = await fetch(URL_SITEVERIFY, { method: 'POST', body: cuerpo, signal: AbortSignal.timeout(5_000) })
        if (!r.ok) {
          opciones.alFallar?.(`siteverify HTTP ${r.status}`)
          return false
        }
        const datos = RespuestaSiteverify.safeParse(await r.json())
        if (!datos.success) return false
        if (!datos.data.success) {
          opciones.alFallar?.(`siteverify rechazó: ${(datos.data['error-codes'] ?? []).join(',').slice(0, 120)}`)
          return false
        }
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
