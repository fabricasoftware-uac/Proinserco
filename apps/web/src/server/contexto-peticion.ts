import 'server-only'
import { headers } from 'next/headers'
import { ipCliente } from './ip'

/** IP (resuelta según el despliegue) y user agent de la petición en curso. */
export async function contextoPeticion(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers()
  return { ip: ipCliente(h), userAgent: h.get('user-agent')?.slice(0, 300) ?? null }
}

/** Nonce de la CSP de esta petición (lo pone src/proxy.ts). */
export async function nonceCsp(): Promise<string | undefined> {
  return (await headers()).get('x-nonce') ?? undefined
}
