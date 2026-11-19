import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Comprobaciones estáticas de la configuración de despliegue (revisión del backend, punto 1). */
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const leer = (ruta: string) => readFileSync(`${RAIZ}${ruta}`, 'utf8')

describe('configuración de build, CI y entorno', () => {
  it('.dockerignore excluye CUALQUIER .env de cualquier carpeta (apps/web/.env.local incluido)', () => {
    const lineas = leer('.dockerignore').split(/\r?\n/)
    expect(lineas).toContain('**/.env*')
    expect(lineas).not.toContain('.env*')
  })

  it('la CI fija todas las actions por SHA de commit', () => {
    const usos = [...leer('.github/workflows/ci.yml').matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1] ?? '')
    expect(usos.length).toBeGreaterThan(0)
    for (const uso of usos) expect(uso).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/)
  })

  it('la CI y el Dockerfile no construyen producción con la clave de pruebas de Turnstile', () => {
    const ci = leer('.github/workflows/ci.yml')
    expect(ci).not.toContain('1x00000000000000000000AA')
    expect(ci).toContain('node scripts/verificar-clave-turnstile.mjs')
    const docker = leer('Dockerfile')
    expect(docker).not.toMatch(/ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=/)
    expect(docker).toContain('scripts/verificar-clave-turnstile.mjs')
  })

  it('la CI tiene un job con Postgres y Redis que ejecuta los tests de integración', () => {
    const ci = leer('.github/workflows/ci.yml')
    expect(ci).toMatch(/integracion:/)
    expect(ci).toMatch(/TEST_DATABASE_URL:/)
    expect(ci).toMatch(/TEST_REDIS_URL:/)
    expect(ci).toContain('scripts/aplicar-migraciones.sh')
  })

  it('.env.example documenta (sin valores) las variables nuevas, cada una con su comentario', () => {
    const lineas = leer('.env.example').split(/\r?\n/)
    for (const variable of [
      'ALTA_USUARIO_CONTRASENA',
      'TEST_DATABASE_URL',
      'TEST_REDIS_URL',
      'ALERTAS_WEBHOOK_URL',
      'RESEND_API_KEY',
      'RESEND_DESDE',
      'RESEND_CORREO_INTERNO',
    ]) {
      const i = lineas.findIndex((l) => l.startsWith(`${variable}=`))
      expect(i, variable).toBeGreaterThan(0)
      expect(lineas[i], variable).toBe(`${variable}=""`)
      expect(lineas[i - 1]?.startsWith('#'), `${variable} sin comentario`).toBe(true)
    }
  })

  it('los adaptadores con secretos de servidor importan server-only', () => {
    for (const ruta of [
      'apps/web/src/modules/donaciones/infrastructure/pasarela-openpay.ts',
      'apps/web/src/modules/donaciones/infrastructure/correos-donacion-resend.ts',
      'apps/web/src/shared/infrastructure/limitador-redis.ts',
      'apps/web/src/shared/infrastructure/notificador-webhook.ts',
    ]) {
      expect(leer(ruta).split(/\r?\n/)[0], ruta).toBe("import 'server-only'")
    }
  })

  it('las migraciones nuevas no devuelven al rol público privilegios de tabla sobre datos personales', () => {
    const nuevas = readdirSync(`${RAIZ}supabase/migrations`).filter((f) => f >= '20261118200000')
    expect(nuevas.length).toBeGreaterThanOrEqual(2)
    for (const archivo of nuevas) {
      const sql = leer(`supabase/migrations/${archivo}`)
      expect(sql, archivo).not.toMatch(/GRANT[^;]*ON TABLE public\.(donantes|donaciones)\b[^;]*TO proinserco_publico/i)
      expect(sql, archivo).not.toMatch(/TO proinserco_publico\s+USING \(true\)/i)
    }
  })
})
