import 'server-only'
import type { Alerta, Notificador } from '../application/ports/notificador'

const TIMEOUT_MS = 5_000

export type ConfiguracionNotificadorWebhook = Readonly<{
  /** `ALERTAS_WEBHOOK_URL` (https). Es un secreto: nunca en logs. */
  url: string
  alFallar?: ((motivo: string) => void) | undefined
  timeoutMs?: number | undefined
}>

/**
 * Envía la alerta por POST JSON a un webhook entrante (Slack, Discord, Google Chat,
 * n8n, un relay de correo…). El cuerpo lleva `text` (Slack/Google Chat) y `content`
 * (Discord) con el mismo resumen, más los campos estructurados para automatizaciones.
 * Nunca lanza: si el webhook falla, avisa por `alFallar` (sin la URL).
 */
export function crearNotificadorWebhook(config: ConfiguracionNotificadorWebhook): Notificador {
  const url = new URL(config.url)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('ALERTAS_WEBHOOK_URL debe ser https:// y sin credenciales en la URL')
  }

  return {
    async notificar(alerta: Alerta) {
      const resumen = `[Proinserco][${alerta.severidad.toUpperCase()}] ${alerta.titulo}`
      const lineas = Object.entries(alerta.detalles).map(([clave, valor]) => `• ${clave}: ${String(valor)}`)
      const texto = [resumen, ...lineas].join('\n').slice(0, 1_900)
      try {
        const respuesta = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: texto,
            content: texto,
            titulo: alerta.titulo,
            severidad: alerta.severidad,
            detalles: alerta.detalles,
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? TIMEOUT_MS),
          redirect: 'error',
        })
        if (!respuesta.ok) config.alFallar?.(`HTTP ${respuesta.status}`)
      } catch (error) {
        config.alFallar?.(error instanceof Error ? error.name : 'ErrorDesconocido')
      }
    },
  }
}
