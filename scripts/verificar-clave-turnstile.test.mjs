// Pruebas de la comprobación de la clave de Turnstile en builds de producción (node:test).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluarClaveTurnstile } from './verificar-clave-turnstile.mjs'

describe('verificar-clave-turnstile', () => {
  it('en modo estricto (Docker/CI de producción) falla sin clave o con una clave de pruebas', () => {
    assert.equal(evaluarClaveTurnstile({ EXIGIR_CLAVE_TURNSTILE_REAL: 'si' }).ok, false)
    assert.equal(evaluarClaveTurnstile({ EXIGIR_CLAVE_TURNSTILE_REAL: 'si', NEXT_PUBLIC_TURNSTILE_SITE_KEY: ' ' }).ok, false)
    assert.equal(
      evaluarClaveTurnstile({ EXIGIR_CLAVE_TURNSTILE_REAL: 'si', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }).ok,
      false,
    )
    assert.equal(
      evaluarClaveTurnstile({ EXIGIR_CLAVE_TURNSTILE_REAL: 'si', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '3x00000000000000000000FF' }).ok,
      false,
    )
    assert.equal(
      evaluarClaveTurnstile({ EXIGIR_CLAVE_TURNSTILE_REAL: 'si', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAREALREAL' }).ok,
      true,
    )
  })

  it('el build de producción de Vercel también es estricto; los demás builds solo avisan', () => {
    assert.equal(evaluarClaveTurnstile({ VERCEL_ENV: 'production' }).ok, false)
    assert.equal(evaluarClaveTurnstile({ VERCEL_ENV: 'preview' }).ok, true)
    const local = evaluarClaveTurnstile({})
    assert.equal(local.ok, true)
    assert.match(local.motivo ?? '', /Falta/)
  })
})
