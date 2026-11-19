import { z } from 'zod'
import { esClaveDePruebaTurnstile } from '@/shared/domain/antibots'

/**
 * ESQUEMA de las variables de entorno del SERVIDOR (sin 'server-only' para poder
 * validarlo también al arrancar desde src/instrumentation.ts). El acceso normal es
 * `obtenerEnv()` en ./env.ts.
 *
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

export const EsquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.url().transform((u) => u.replace(/\/$/, '')),
    ADAPTADORES: z.enum(['memoria', 'real']).default('memoria'),
    ADAPTADORES_MEMORIA_EN_PRODUCCION: siNo.default('no'),
    ANTIBOTS: z.enum(['memoria', 'turnstile']).optional(),
    /** Autoriza la casilla de demostración en producción (solo una demo pública, jamás el sitio real). */
    ANTIBOTS_MEMORIA_EN_PRODUCCION: siNo.default('no'),
    // cloudflare: VPS tras Cloudflare (CF-Connecting-IP) · directo: VPS con Traefik (X-Real-IP)
    // vercel: serverless (X-Real-IP que fija Vercel). Serverless = varias instancias.
    DESPLIEGUE: z.enum(['cloudflare', 'directo', 'vercel']).default('directo'),
    /** Lo define Vercel en sus builds y funciones ("1"). Fuerza las reglas de serverless. */
    VERCEL: z.string().optional(),

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
    OPENPAY_SANDBOX_EN_PRODUCCION: siNo.default('no'),
    OPENPAY_WEBHOOK_USUARIO: z.string().min(8).optional(),
    OPENPAY_WEBHOOK_CONTRASENA: z.string().min(24).optional(),
    OPENPAY_WEBHOOK_SECRETO_RUTA: z.string().min(32).optional(),
    OPENPAY_CHECKOUT_ORIGIN: z
      .url()
      .refine((u) => new URL(u).protocol === 'https:', 'OPENPAY_CHECKOUT_ORIGIN debe usar https://')
      .transform((u) => new URL(u).origin)
      .optional(),

    // Cron de conciliación diaria
    CRON_CONCILIACION_SECRETO: z.string().min(32).optional(),

    // Turnstile
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    // Pública y del build; si también está en el entorno del servidor se valida aquí.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

    // Limitador de tasa compartido (Redis). Sin valor: memoria (una sola instancia).
    // redis:// (red privada) o rediss:// (TLS, p. ej. Upstash). Obligatoria en serverless.
    LIMITADOR_URL: z
      .string()
      .regex(/^rediss?:\/\/\S+$/i, 'LIMITADOR_URL debe empezar por redis:// o rediss://')
      .optional(),

    // Alertas operativas (conciliación diaria). Opcional: sin ella las alertas van solo al log.
    ALERTAS_WEBHOOK_URL: z
      .url()
      .refine((u) => new URL(u).protocol === 'https:', 'ALERTAS_WEBHOOK_URL debe usar https://')
      .optional(),

    // Correos transaccionales (Resend). Opcionales: si se define RESEND_API_KEY se exige RESEND_DESDE.
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_DESDE: z.string().min(3).optional(),
    RESEND_CORREO_INTERNO: z.email().optional(),
  })
  .superRefine((e, ctx) => {
    const exigir = (claves: readonly (keyof typeof e)[], motivo: string) => {
      for (const clave of claves) if (!e[clave]) ctx.addIssue({ code: 'custom', path: [clave], message: `Obligatoria ${motivo}` })
    }
    if (e.ADAPTADORES === 'real') {
      exigir(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'], 'con ADAPTADORES=real')
      exigir(
        [
          'OPENPAY_MERCHANT_ID',
          'OPENPAY_PRIVATE_KEY',
          'OPENPAY_API_URL',
          'OPENPAY_WEBHOOK_USUARIO',
          'OPENPAY_WEBHOOK_CONTRASENA',
          'OPENPAY_WEBHOOK_SECRETO_RUTA',
        ],
        'con ADAPTADORES=real',
      )
      exigir(['CRON_CONCILIACION_SECRETO'], 'con ADAPTADORES=real')
      exigir(['TURNSTILE_SECRET_KEY'], 'con ADAPTADORES=real')
    }
    if (e.ANTIBOTS === 'turnstile') exigir(['TURNSTILE_SECRET_KEY'], 'con ANTIBOTS=turnstile')
    // Producción: verificación «soy una persona» REAL. Ni la casilla de demostración (salvo
    // autorización explícita) ni las claves de prueba de Cloudflare (1x0000…, 2x0000…, 3x0000…).
    const antibots = e.ANTIBOTS ?? (e.ADAPTADORES === 'real' ? 'turnstile' : 'memoria')
    if (e.NODE_ENV === 'production' && antibots === 'memoria' && e.ANTIBOTS_MEMORIA_EN_PRODUCCION !== 'si') {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTIBOTS'],
        message:
          'Producción sin Turnstile (casilla de demostración). Usa ANTIBOTS=turnstile con claves reales o autorízalo con ANTIBOTS_MEMORIA_EN_PRODUCCION=si (solo demo)',
      })
    }
    if (e.NODE_ENV === 'production' && antibots === 'turnstile') {
      for (const clave of ['TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'] as const) {
        if (esClaveDePruebaTurnstile(e[clave])) {
          ctx.addIssue({
            code: 'custom',
            path: [clave],
            message: 'Clave de PRUEBA de Cloudflare Turnstile prohibida en producción',
          })
        }
      }
    }
    if (e.NODE_ENV === 'production' && e.ADAPTADORES === 'memoria' && e.ADAPTADORES_MEMORIA_EN_PRODUCCION !== 'si') {
      ctx.addIssue({
        code: 'custom',
        path: ['ADAPTADORES'],
        message:
          'Producción con adaptadores en memoria (sin persistencia ni pasarela). Usa ADAPTADORES=real o autorízalo con ADAPTADORES_MEMORIA_EN_PRODUCCION=si',
      })
    }
    // Llaves de sandbox y producción nunca se mezclan (vault: Pagos en Línea).
    // Excepción explícita para staging/pruebas sandbox bajo NODE_ENV=production (Coolify/VPS).
    if (e.ADAPTADORES === 'real' && e.OPENPAY_API_URL) {
      if (e.NODE_ENV === 'production') {
        const permiteSandbox = e.OPENPAY_SANDBOX_EN_PRODUCCION === 'si'
        if (e.OPENPAY_API_URL !== OPENPAY_PRODUCCION && !(permiteSandbox && e.OPENPAY_API_URL === OPENPAY_SANDBOX)) {
          ctx.addIssue({
            code: 'custom',
            path: ['OPENPAY_API_URL'],
            message:
              'Producción debe usar la API de producción de Openpay (o autorizar sandbox con OPENPAY_SANDBOX_EN_PRODUCCION=si)',
          })
        }
      } else if (e.OPENPAY_API_URL !== OPENPAY_SANDBOX) {
        ctx.addIssue({
          code: 'custom',
          path: ['OPENPAY_API_URL'],
          message: 'Fuera de producción debe usarse la API sandbox de Openpay',
        })
      }
    }
    // Serverless (Vercel): cada petición puede caer en una instancia distinta. Un limitador
    // en memoria por instancia no limita nada: login, MFA y donar quedarían sin freno.
    if (e.NODE_ENV === 'production' && esServerless(e) && !e.LIMITADOR_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIMITADOR_URL'],
        message:
          'Obligatoria en despliegues serverless (DESPLIEGUE=vercel o VERCEL definido): el limitador en memoria solo vale con UNA instancia. Usa un Redis compartido (rediss://, p. ej. Upstash)',
      })
    }
    if (e.DONACION_MONTO_MINIMO_COP >= e.DONACION_MONTO_MAXIMO_COP) {
      ctx.addIssue({ code: 'custom', path: ['DONACION_MONTO_MINIMO_COP'], message: 'El mínimo debe ser menor que el máximo' })
    }
    if (e.RESEND_API_KEY && !e.RESEND_DESDE) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_DESDE'], message: 'Obligatoria cuando se define RESEND_API_KEY' })
    }
    if (e.RESEND_DESDE && !e.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Obligatoria cuando se define RESEND_DESDE' })
    }
  })

/** Varias instancias efímeras: el estado en memoria (limitador) no se comparte. */
export function esServerless(e: { DESPLIEGUE: string; VERCEL?: string | undefined }): boolean {
  return e.DESPLIEGUE === 'vercel' || Boolean(e.VERCEL)
}

export type Env = z.infer<typeof EsquemaEnv> & { esHttps: boolean; hostname: string; antibots: 'memoria' | 'turnstile' }

/** Resultado de validar: el entorno listo o la lista de problemas (solo nombres y motivos, nunca valores). */
export function validarEnv(
  fuente: Record<string, string | undefined>,
): { ok: true; env: Env } | { ok: false; problemas: string[] } {
  const resultado = EsquemaEnv.safeParse(fuente)
  if (!resultado.success) {
    return { ok: false, problemas: resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }
  const datos = resultado.data
  const url = new URL(datos.APP_URL)
  return {
    ok: true,
    env: {
      ...datos,
      esHttps: url.protocol === 'https:',
      hostname: url.hostname,
      antibots: datos.ANTIBOTS ?? (datos.ADAPTADORES === 'real' ? 'turnstile' : 'memoria'),
    },
  }
}
