import { afterEach, describe, expect, it, vi } from 'vitest'

function configurarBaseReal() {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('APP_URL', 'https://proinserco.org')
  vi.stubEnv('ADAPTADORES', 'real')
  vi.stubEnv('SESION_SECRETO', 's'.repeat(32))
  vi.stubEnv('SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:6543/postgres')
  vi.stubEnv('OPENPAY_MERCHANT_ID', 'm_123')
  vi.stubEnv('OPENPAY_PRIVATE_KEY', 'sk_123')
  vi.stubEnv('OPENPAY_API_URL', 'https://sandbox-api.openpay.co')
  vi.stubEnv('OPENPAY_WEBHOOK_USUARIO', 'openpay_usr')
  vi.stubEnv('OPENPAY_WEBHOOK_CONTRASENA', 'c'.repeat(24))
  vi.stubEnv('OPENPAY_WEBHOOK_SECRETO_RUTA', 'w'.repeat(32))
  vi.stubEnv('CRON_CONCILIACION_SECRETO', 'k'.repeat(32))
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'turnstile-secret')
}

describe('obtenerEnv Fase 4A', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('exige OPENPAY_WEBHOOK_SECRETO_RUTA y CRON_CONCILIACION_SECRETO cuando ADAPTADORES=real', async () => {
    configurarBaseReal()
    vi.stubEnv('OPENPAY_WEBHOOK_SECRETO_RUTA', undefined)
    vi.resetModules()
    const { obtenerEnv } = await import('./env')
    expect(() => obtenerEnv()).toThrow('Configuración de entorno inválida')

    configurarBaseReal()
    vi.stubEnv('CRON_CONCILIACION_SECRETO', undefined)
    vi.resetModules()
    const { obtenerEnv: obtenerEnv2 } = await import('./env')
    expect(() => obtenerEnv2()).toThrow('Configuración de entorno inválida')
  })

  it('valida OPENPAY_CHECKOUT_ORIGIN con protocolo https y normaliza a origin', async () => {
    configurarBaseReal()
    vi.stubEnv('OPENPAY_CHECKOUT_ORIGIN', 'https://pagos.openpay.co/algo')
    vi.resetModules()
    const { obtenerEnv } = await import('./env')
    expect(obtenerEnv().OPENPAY_CHECKOUT_ORIGIN).toBe('https://pagos.openpay.co')

    configurarBaseReal()
    vi.stubEnv('OPENPAY_CHECKOUT_ORIGIN', 'http://pagos.openpay.co')
    vi.resetModules()
    const { obtenerEnv: obtenerEnvHttp } = await import('./env')
    expect(() => obtenerEnvHttp()).toThrow('Configuración de entorno inválida')
  })

  it('en production exige api.openpay.co salvo autorización explícita OPENPAY_SANDBOX_EN_PRODUCCION=si', async () => {
    configurarBaseReal()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OPENPAY_API_URL', 'https://sandbox-api.openpay.co')
    vi.resetModules()
    const { obtenerEnv: sinPermiso } = await import('./env')
    expect(() => sinPermiso()).toThrow('Configuración de entorno inválida')

    configurarBaseReal()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OPENPAY_API_URL', 'https://sandbox-api.openpay.co')
    vi.stubEnv('OPENPAY_SANDBOX_EN_PRODUCCION', 'si')
    vi.resetModules()
    const { obtenerEnv: conPermiso } = await import('./env')
    expect(conPermiso().OPENPAY_SANDBOX_EN_PRODUCCION).toBe('si')
    expect(conPermiso().OPENPAY_API_URL).toBe('https://sandbox-api.openpay.co')

    configurarBaseReal()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OPENPAY_API_URL', 'https://api.openpay.co')
    vi.stubEnv('OPENPAY_SANDBOX_EN_PRODUCCION', 'no')
    vi.resetModules()
    const { obtenerEnv: prodReal } = await import('./env')
    expect(prodReal().OPENPAY_API_URL).toBe('https://api.openpay.co')
  })

  it('fuera de production sigue exigiendo sandbox-api.openpay.co aunque OPENPAY_SANDBOX_EN_PRODUCCION=si', async () => {
    configurarBaseReal()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('OPENPAY_API_URL', 'https://api.openpay.co')
    vi.stubEnv('OPENPAY_SANDBOX_EN_PRODUCCION', 'si')
    vi.resetModules()
    const { obtenerEnv } = await import('./env')
    expect(() => obtenerEnv()).toThrow('Configuración de entorno inválida')
  })
})
