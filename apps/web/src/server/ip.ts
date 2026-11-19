import 'server-only'
import { obtenerEnv } from './env'

const IP_VALIDA = /^[0-9a-fA-F:.]{3,45}$/

/**
 * IP del cliente según el despliegue. NUNCA el primer valor de
 * X-Forwarded-For sin más: lo escribe el atacante.
 *  - cloudflare: `CF-Connecting-IP`. Solo es fiable si el origen rechaza todo lo
 *    que no venga de Cloudflare (firewall o Cloudflare Tunnel).
 *  - directo: `X-Real-IP` que fija el proxy de Coolify (Traefik).
 *  - vercel: `X-Real-IP`, que Vercel fija con la IP del cliente (no la reenvía del cliente).
 * Sin IP: un cubo compartido y estricto, nunca "sin límite".
 */
export function ipCliente(cabeceras: Headers): string {
  const valor = obtenerEnv().DESPLIEGUE === 'cloudflare' ? cabeceras.get('cf-connecting-ip') : cabeceras.get('x-real-ip')
  const ip = valor?.trim()
  return ip && IP_VALIDA.test(ip) ? ip : 'desconocida'
}
