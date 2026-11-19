import '@/shared/lib/zod-sin-eval'
import { z } from 'zod'

/**
 * Variables PÚBLICAS: Next las incrusta en el JavaScript del navegador en
 * tiempo de BUILD. Antes de añadir una: ¿me da igual publicarla en un cartel?
 * Archivo separado de src/server/env.ts para que mezclarlas sea imposible.
 */
const EsquemaPublico = z.object({
  /** Site key de Turnstile (pública por diseño). 1x00000000000000000000AA = clave de pruebas de Cloudflare. */
  // Vacía = no definida (el Dockerfile la declara sin valor por defecto). En builds de
  // producción scripts/verificar-clave-turnstile.mjs impide llegar aquí con la de pruebas.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().min(1).default('1x00000000000000000000AA'),
  ),
})

// Acceso explícito a cada variable: Next solo sustituye `process.env.NEXT_PUBLIC_X` literal.
export const envPublico = EsquemaPublico.parse({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
})
