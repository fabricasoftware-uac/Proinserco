import 'server-only'
import { z } from 'zod'

/**
 * Variables de entorno del SERVIDOR, validadas con Zod. Se validan en el
 * primer uso (no al importar) para que `next build` no exija los secretos
 * de producción; en tiempo de ejecución, una variable inválida rompe la
 * petición con un error claro en el log, nunca un `undefined` silencioso.
 *
 * Las públicas (NEXT_PUBLIC_*) viven en src/shared/env-publico.ts.
 * Documentación de cada variable: .env.example en la raíz.
 */
const siNo = z.enum(['si', 'no'])
const OPENPAY_SANDBOX = 'https://sandbox-api.openpay.co'
const OPENPAY_PRODUCCION = 'https://api.openpay.co'

const EsquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.url().transform((u) => u.replace(/\/$/, '')),
    ADAPTADORES: z.enum(['memoria', 'real']).default('memoria'),
    ADAPTADORES_MEMORIA_EN_PRODUCCION: siNo.default('no'),
    ANTIBOTS: z.enum(['memoria', 'turnstile']).optional(),
    DESPLIEGUE: z.enum(['cloudflare', 'directo']).default('directo'),

    SESION_SECRETO: z.string().min(32, 'SESION_SECRETO: mínimo 32 caracteres aleatorios'),

    DONACIONES_HABILITADAS: siNo.default('si'),
    DONACION_MONTO_MINIMO_COP: z.coerce.number().int().positive().default(10_000),
    DONACION_MONTO_MAXIMO_COP: z.coerce.number().int().positive().default(20_000_000),

    CSP_SOLO_REPORTE: siNo.default('no'),

    // Supabase (solo servidor; el navegador nunca habla con Supabase)
    SUPABASE_URL: z.url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    DATABASE_URL: z.string().startsWith('postgres').optional(),
    DATABASE_URL_DIRECT: z.string().startsWith('postgres').optional(),

    // Openpay
    OPENPAY_MERCHANT_ID: z.string().min(1).optional(),
    OPENPAY_PRIVATE_KEY: z.string().min(1).optional(),
    OPENPAY_API_URL: z.enum([OPENPAY_SANDBOX, OPENPAY_PRODUCCION]).optional(),
    OPENPAY_WEBHOOK_USUARIO: z.string().min(8).optional(),
    OPENPAY_WEBHOOK_CONTRASENA: z.string().min(24).optional(),

    // Turnstile
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),

    // Limitador de tasa compartido (Redis). Sin valor: memoria (una sola instancia).
    LIMITADOR_URL: z.string().startsWith('redis').optional(),
  })
  .superRefine((e, ctx) => {
    const exigir = (claves: readonly (keyof typeof e)[], motivo: string) => {
      for (const clave of claves) if (!e[clave]) ctx.addIssue({ code: 'custom', path: [clave], message: `Obligatoria ${motivo}` })
    }
    if (e.ADAPTADORES === 'real') {
      exigir(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'], 'con ADAPTADORES=real')
      exigir(['OPENPAY_MERCHANT_ID', 'OPENPAY_PRIVATE_KEY', 'OPENPAY_API_URL'], 'con ADAPTADORES=real')
      exigir(['OPENPAY_WEBHOOK_USUARIO', 'OPENPAY_WEBHOOK_CONTRASENA'], 'con ADAPTADORES=real')
      exigir(['TURNSTILE_SECRET_KEY'], 'con ADAPTADORES=real')
    }
    if (e.ANTIBOTS === 'turnstile') exigir(['TURNSTILE_SECRET_KEY'], 'con ANTIBOTS=turnstile')
    if (e.NODE_ENV === 'production' && e.ADAPTADORES === 'memoria' && e.ADAPTADORES_MEMORIA_EN_PRODUCCION !== 'si') {
      ctx.addIssue({
        code: 'custom',
        path: ['ADAPTADORES'],
        message:
          'Producción con adaptadores en memoria (usuarios demo, pasarela simulada). Usa ADAPTADORES=real o autorízalo con ADAPTADORES_MEMORIA_EN_PRODUCCION=si',
      })
    }
    // Llaves de sandbox y producción nunca se mezclan (vault: Pagos en Línea).
    if (e.ADAPTADORES === 'real' && e.OPENPAY_API_URL) {
      const esProduccion = e.NODE_ENV === 'production'
      if (esProduccion !== (e.OPENPAY_API_URL === OPENPAY_PRODUCCION)) {
        ctx.addIssue({
          code: 'custom',
          path: ['OPENPAY_API_URL'],
          message: 'Producción debe usar la API de producción de Openpay y el resto, el sandbox',
        })
      }
    }
    if (e.DONACION_MONTO_MINIMO_COP >= e.DONACION_MONTO_MAXIMO_COP) {
      ctx.addIssue({ code: 'custom', path: ['DONACION_MONTO_MINIMO_COP'], message: 'El mínimo debe ser menor que el máximo' })
    }
  })

export type Env = z.infer<typeof EsquemaEnv> & { esHttps: boolean; hostname: string; antibots: 'memoria' | 'turnstile' }

let cache: Env | null = null

export function obtenerEnv(): Env {
  if (cache) return cache
  const resultado = EsquemaEnv.safeParse(process.env)
  if (!resultado.success) {
    // Solo nombres de variables y motivos: nunca los valores.
    const problemas = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    console.error(JSON.stringify({ nivel: 'error', mensaje: 'Variables de entorno inválidas', problemas }))
    throw new Error('Configuración de entorno inválida. Revisa el log del servidor y .env.example')
  }
  const datos = resultado.data
  const url = new URL(datos.APP_URL)
  cache = {
    ...datos,
    esHttps: url.protocol === 'https:',
    hostname: url.hostname,
    antibots: datos.ANTIBOTS ?? (datos.ADAPTADORES === 'real' ? 'turnstile' : 'memoria'),
  }
  return cache
}
