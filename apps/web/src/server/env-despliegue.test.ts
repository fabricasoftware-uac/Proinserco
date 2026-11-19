import { describe, expect, it } from 'vitest'
import { esServerless, validarEnv } from './env-esquema'

const BASE_REAL_PRODUCCION = {
  NODE_ENV: 'production',
  APP_URL: 'https://proinserco.org',
  ADAPTADORES: 'real',
  SESION_SECRETO: 's'.repeat(32),
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  DATABASE_URL: 'postgresql://user:pass@localhost:6543/postgres',
  OPENPAY_MERCHANT_ID: 'm_123',
  OPENPAY_PRIVATE_KEY: 'sk_123',
  OPENPAY_API_URL: 'https://api.openpay.co',
  OPENPAY_WEBHOOK_USUARIO: 'openpay_usr',
  OPENPAY_WEBHOOK_CONTRASENA: 'c'.repeat(24),
  OPENPAY_WEBHOOK_SECRETO_RUTA: 'w'.repeat(32),
  CRON_CONCILIACION_SECRETO: 'k'.repeat(32),
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
} as const

function problemas(fuente: Record<string, string | undefined>): string[] {
  const r = validarEnv(fuente)
  return r.ok ? [] : r.problemas
}

describe('entorno según el despliegue (VPS o Vercel)', () => {
  it('VPS (una instancia) arranca sin LIMITADOR_URL', () => {
    expect(validarEnv({ ...BASE_REAL_PRODUCCION, DESPLIEGUE: 'cloudflare' }).ok).toBe(true)
    expect(validarEnv({ ...BASE_REAL_PRODUCCION }).ok).toBe(true)
  })

  it('serverless (DESPLIEGUE=vercel o VERCEL definido) en producción sin LIMITADOR_URL NO arranca, con un error claro', () => {
    for (const extra of [{ DESPLIEGUE: 'vercel' }, { VERCEL: '1' }, { DESPLIEGUE: 'directo', VERCEL: '1' }]) {
      const lista = problemas({ ...BASE_REAL_PRODUCCION, ...extra })
      expect(lista).toHaveLength(1)
      expect(lista[0]).toMatch(/^LIMITADOR_URL: Obligatoria en despliegues serverless/)
    }
    // También una demo en memoria autorizada en Vercel: el limitador en memoria no limita nada.
    expect(
      problemas({
        NODE_ENV: 'production',
        APP_URL: 'https://x.vercel.app',
        SESION_SECRETO: 's'.repeat(32),
        ADAPTADORES_MEMORIA_EN_PRODUCCION: 'si',
        ANTIBOTS_MEMORIA_EN_PRODUCCION: 'si',
        VERCEL: '1',
      }),
    ).toEqual([expect.stringMatching(/^LIMITADOR_URL/)])
  })

  it('serverless arranca con Redis por TLS (rediss://, p. ej. Upstash) o redis://; fuera de producción no lo exige', () => {
    expect(
      validarEnv({ ...BASE_REAL_PRODUCCION, VERCEL: '1', LIMITADOR_URL: 'rediss://default:tok@eu1-x.upstash.io:6379' }).ok,
    ).toBe(true)
    expect(validarEnv({ ...BASE_REAL_PRODUCCION, DESPLIEGUE: 'vercel', LIMITADOR_URL: 'redis://redis:6379' }).ok).toBe(true)
    expect(problemas({ ...BASE_REAL_PRODUCCION, LIMITADOR_URL: 'https://redis.test' })[0]).toMatch(/redis:\/\/ o rediss:\/\//)
    expect(
      validarEnv({
        ...BASE_REAL_PRODUCCION,
        NODE_ENV: 'development',
        OPENPAY_API_URL: 'https://sandbox-api.openpay.co',
        VERCEL: '1',
      }).ok,
    ).toBe(true)
  })

  it('ALERTAS_WEBHOOK_URL es opcional y solo https', () => {
    expect(validarEnv({ ...BASE_REAL_PRODUCCION, ALERTAS_WEBHOOK_URL: 'https://hooks.slack.com/services/x' }).ok).toBe(true)
    expect(problemas({ ...BASE_REAL_PRODUCCION, ALERTAS_WEBHOOK_URL: 'http://hooks.test/x' })[0]).toMatch(/^ALERTAS_WEBHOOK_URL/)
  })

  it('esServerless', () => {
    expect(esServerless({ DESPLIEGUE: 'vercel' })).toBe(true)
    expect(esServerless({ DESPLIEGUE: 'directo', VERCEL: '1' })).toBe(true)
    expect(esServerless({ DESPLIEGUE: 'cloudflare' })).toBe(false)
  })

  it('producción exige Turnstile real: sin casilla de demostración (salvo override) ni claves de prueba de Cloudflare', () => {
    const demo = {
      NODE_ENV: 'production',
      APP_URL: 'https://demo.test',
      SESION_SECRETO: 's'.repeat(32),
      ADAPTADORES_MEMORIA_EN_PRODUCCION: 'si',
    }
    expect(problemas(demo)).toEqual([expect.stringMatching(/^ANTIBOTS: Producción sin Turnstile/)])
    expect(validarEnv({ ...demo, ANTIBOTS_MEMORIA_EN_PRODUCCION: 'si' }).ok).toBe(true)
    expect(problemas({ ...BASE_REAL_PRODUCCION, ANTIBOTS: 'memoria' })[0]).toMatch(/^ANTIBOTS/)

    for (const prueba of [
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
      '3x0000000000000000000000000000000AA',
    ]) {
      expect(problemas({ ...BASE_REAL_PRODUCCION, TURNSTILE_SECRET_KEY: prueba })[0]).toMatch(
        /^TURNSTILE_SECRET_KEY: Clave de PRUEBA/,
      )
    }
    expect(problemas({ ...BASE_REAL_PRODUCCION, NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' })[0]).toMatch(
      /^NEXT_PUBLIC_TURNSTILE_SITE_KEY/,
    )
    // Fuera de producción las claves de prueba son las correctas para desarrollo.
    expect(
      validarEnv({
        ...BASE_REAL_PRODUCCION,
        NODE_ENV: 'development',
        OPENPAY_API_URL: 'https://sandbox-api.openpay.co',
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      }).ok,
    ).toBe(true)
  })
})
