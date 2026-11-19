import 'server-only'
import { CENTAVOS_POR_PESO } from '@/shared/domain/importe'
import type { Donacion } from '../domain/donacion'
import type { LineaApoyo } from '../domain/linea-apoyo'

const RESEND_API_URL = 'https://api.resend.com/emails'
const TIMEOUT_MS = 8_000

const ETIQUETAS_LINEA: Readonly<Record<LineaApoyo, string>> = {
  'donde-mas-se-necesite': 'Donde más se necesite',
  educacion: 'Educación y capacitación',
  salud: 'Salud comunitaria',
  agricola: 'Desarrollo agrícola y rural',
}

export type ConfiguracionCorreosResend = Readonly<{
  /** Clave secreta de Resend (`re_…`). Solo servidor, nunca en logs. */
  apiKey: string
  /** Remitente verificado en Resend, p. ej. `Fundación Proinserco <donaciones@proinserco.org>`. */
  desde: string
  /** URL base pública del sitio (`env.APP_URL`), sin barra final. */
  urlBase: string
  /** Correo interno opcional de la fundación para avisos de donaciones aprobadas y certificados. */
  correoInterno?: string | undefined
  /** Callback para registrar fallos sin exponer secretos ni tumbar la transacción. */
  alFallar?: ((motivo: string, contexto: { referencia: string; destino: 'donante' | 'interno' }) => void) | undefined
  timeoutMs?: number | undefined
}>

export interface EnviadorCorreosDonacion {
  enviarDonacionAprobada(donacion: Donacion): Promise<void>
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatearPesosCop(centavos: bigint): string {
  const pesos = Number(centavos / CENTAVOS_POR_PESO)
  return `$${pesos.toLocaleString('es-CO')} COP`
}

function construirCorreoDonante(donacion: Donacion, urlBase: string): { asunto: string; html: string; text: string } {
  const { referencia, importe, linea, pagador, quiereCertificado, metodoPago } = donacion.datos
  const monto = formatearPesosCop(importe.centavos)
  const lineaTexto = ETIQUETAS_LINEA[linea]
  const urlResultado = `${urlBase.replace(/\/$/, '')}/donar/resultado?referencia=${encodeURIComponent(referencia)}`
  const nombreSeguro = escaparHtml(pagador.nombres)
  const referenciaSegura = escaparHtml(referencia)
  const montoSeguro = escaparHtml(monto)
  const lineaSegura = escaparHtml(lineaTexto)
  const metodoSeguro = metodoPago ? escaparHtml(metodoPago) : 'Pasarela en línea Openpay'
  const urlSegura = escaparHtml(urlResultado)

  const notaCertificadoTexto = quiereCertificado
    ? 'Solicitaste certificado de donación: nuestro equipo administrativo validará los datos registrados y te enviará el certificado correspondiente.'
    : 'Este correo constituye el comprobante informativo de tu aporte.'

  const asunto = `¡Gracias por tu donación a la Fundación Proinserco! (${referencia})`

  const text = [
    `Hola, ${pagador.nombres}:`,
    '',
    'Hemos recibido y confirmado tu donación a la Fundación Proinserco. ¡Muchas gracias por tu apoyo!',
    '',
    `Referencia: ${referencia}`,
    `Monto: ${monto}`,
    `Línea de impacto: ${lineaTexto}`,
    `Medio de pago: ${metodoPago ?? 'Pasarela en línea Openpay'}`,
    '',
    notaCertificadoTexto,
    '',
    `Puedes consultar el estado de tu donación en: ${urlResultado}`,
    '',
    'Con gratitud,',
    'Fundación Proinserco — Popayán, Cauca',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background-color:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#182218;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e2e0d8;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px;background-color:#153624;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">Fundación Proinserco</p>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">¡Gracias por tu donación!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hola, <strong>${nombreSeguro}</strong>:</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">Tu aporte ha sido confirmado exitosamente. Gracias por impulsar nuestros programas sociales y comunitarios en el Cauca.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f7f3;border-radius:8px;padding:16px;margin-bottom:20px;">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#525c52;">Referencia</td>
              <td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${referenciaSegura}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#525c52;">Monto confirmado</td>
              <td style="padding:6px 0;font-size:16px;font-weight:700;text-align:right;color:#153624;">${montoSeguro}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#525c52;">Línea de apoyo</td>
              <td style="padding:6px 0;font-size:14px;text-align:right;">${lineaSegura}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#525c52;">Medio de pago</td>
              <td style="padding:6px 0;font-size:14px;text-align:right;">${metodoSeguro}</td>
            </tr>
          </table>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3d473d;">${escaparHtml(notaCertificadoTexto)}</p>
          <p style="margin:0 0 8px;">
            <a href="${urlSegura}" style="display:inline-block;padding:12px 20px;background-color:#153624;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Ver comprobante en línea</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;background-color:#f8f7f3;font-size:12px;color:#636d63;border-top:1px solid #e2e0d8;">
          Fundación Proinserco · Popayán, Cauca, Colombia
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { asunto, html, text }
}

function construirCorreoInterno(donacion: Donacion, urlBase: string): { asunto: string; html: string; text: string } {
  const { id, referencia, importe, linea, pagador, quiereCertificado, metodoPago } = donacion.datos
  const monto = formatearPesosCop(importe.centavos)
  const lineaTexto = ETIQUETAS_LINEA[linea]
  const urlPanel = `${urlBase.replace(/\/$/, '')}/panel/donaciones/${encodeURIComponent(id)}`
  const prefijoCertificado = quiereCertificado ? '[CERTIFICADO SOLICITADO] ' : ''
  const asunto = `${prefijoCertificado}Nueva donación aprobada — ${monto} (${referencia})`

  const text = [
    'Nueva donación aprobada en Fundación Proinserco',
    '',
    `Referencia: ${referencia}`,
    `Monto: ${monto}`,
    `Línea de apoyo: ${lineaTexto}`,
    `Medio de pago: ${metodoPago ?? 'No especificado'}`,
    `Donante / Pagador: ${pagador.nombres} ${pagador.apellidos}`,
    `Correo del pagador: ${pagador.correo}`,
    `¿Solicitó certificado de donación?: ${quiereCertificado ? 'SÍ (expedir certificado)' : 'No'}`,
    '',
    `Ver detalle en el panel administrativo: ${urlPanel}`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background-color:#f6f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#182218;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e2e0d8;overflow:hidden;">
      <tr>
        <td style="padding:20px 28px;background-color:#153624;color:#ffffff;">
          <h2 style="margin:0;font-size:18px;">Nueva donación aprobada — ${escaparHtml(monto)}</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px;font-size:14px;line-height:1.6;">
          ${
            quiereCertificado
              ? '<p style="margin:0 0 16px;padding:10px 14px;background-color:#fff4e5;border-left:4px solid #b45309;color:#7c2d12;font-weight:600;">El donante solicitó certificado tributario de donación.</p>'
              : ''
          }
          <p style="margin:0 0 8px;"><strong>Referencia:</strong> <code>${escaparHtml(referencia)}</code></p>
          <p style="margin:0 0 8px;"><strong>Monto:</strong> ${escaparHtml(monto)}</p>
          <p style="margin:0 0 8px;"><strong>Línea de apoyo:</strong> ${escaparHtml(lineaTexto)}</p>
          <p style="margin:0 0 8px;"><strong>Medio de pago:</strong> ${escaparHtml(metodoPago ?? 'No especificado')}</p>
          <p style="margin:0 0 8px;"><strong>Pagador:</strong> ${escaparHtml(`${pagador.nombres} ${pagador.apellidos}`)} (${escaparHtml(pagador.correo)})</p>
          <p style="margin:0 0 20px;"><strong>Solicitó certificado:</strong> ${quiereCertificado ? 'SÍ' : 'No'}</p>
          <p style="margin:0;">
            <a href="${escaparHtml(urlPanel)}" style="display:inline-block;padding:10px 18px;background-color:#153624;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Abrir en el panel administrativo</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { asunto, html, text }
}

/**
 * Adaptador de correos transaccionales de donaciones sobre la API HTTP de Resend.
 * - Usa `Idempotency-Key` por referencia y destinatario para que reintentos o
 *   dobles consultas jamás envíen correos duplicados.
 * - Nunca lanza ni expone `RESEND_API_KEY`: si Resend falla, avisa por `alFallar`.
 */
export function crearEnviadorCorreosResend(config: ConfiguracionCorreosResend): EnviadorCorreosDonacion {
  if (!config.apiKey.trim() || !config.desde.trim()) {
    throw new Error('Configuración de Resend incompleta (RESEND_API_KEY y RESEND_DESDE son obligatorias)')
  }

  async function enviar(
    para: string,
    contenido: { asunto: string; html: string; text: string },
    claveIdempotencia: string,
    contexto: { referencia: string; destino: 'donante' | 'interno' },
  ): Promise<void> {
    try {
      const respuesta = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': claveIdempotencia,
        },
        body: JSON.stringify({
          from: config.desde,
          to: [para],
          subject: contenido.asunto,
          html: contenido.html,
          text: contenido.text,
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? TIMEOUT_MS),
        redirect: 'error',
      })
      if (!respuesta.ok) {
        config.alFallar?.(`HTTP ${respuesta.status}`, contexto)
      }
    } catch (error) {
      config.alFallar?.(error instanceof Error ? error.name : 'ErrorDesconocido', contexto)
    }
  }

  return {
    async enviarDonacionAprobada(donacion: Donacion): Promise<void> {
      if (donacion.estado !== 'aprobada') return

      const referencia = donacion.datos.referencia
      const correoDonante = construirCorreoDonante(donacion, config.urlBase)
      await enviar(donacion.datos.pagador.correo, correoDonante, `donacion-aprobada-donante-${referencia}`, {
        referencia,
        destino: 'donante',
      })

      const interno = config.correoInterno?.trim()
      if (interno) {
        const correoInterno = construirCorreoInterno(donacion, config.urlBase)
        await enviar(interno, correoInterno, `donacion-aprobada-interno-${referencia}`, { referencia, destino: 'interno' })
      }
    },
  }
}
