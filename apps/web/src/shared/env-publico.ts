import '@/shared/lib/zod-sin-eval'
import { z } from 'zod'

/**
 * Variables PÚBLICAS: Next las incrusta en el JavaScript del navegador en
 * tiempo de BUILD. Antes de añadir una: ¿me da igual publicarla en un cartel?
 * Archivo separado de src/server/env.ts para que mezclarlas sea imposible.
 */
const EsquemaPublico = z.object({
  /** Site key de Turnstile (pública por diseño). 1x00000000000000000000AA = clave de pruebas de Cloudflare. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).default('1x00000000000000000000AA'),
})

// Acceso explícito a cada variable: Next solo sustituye `process.env.NEXT_PUBLIC_X` literal.
export const envPublico = EsquemaPublico.parse({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
})
