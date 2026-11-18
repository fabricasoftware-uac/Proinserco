import { describe, expect, it } from 'vitest'
import { construirCsp, normalizarOrigenHttps } from './csp'

function extraerDirectiva(csp: string, nombre: string): string {
  const parte = csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${nombre} `))
  return parte ?? ''
}

describe('construirCsp (Openpay + Turnstile)', () => {
  it('en producción incluye api.openpay.co y checkout.openpay.co en form-action, excluye sandbox y no los abre en script-src/connect-src', () => {
    const csp = construirCsp({
      nonce: 'nonce-prod-123',
      esDesarrollo: false,
      esHttps: true,
    })

    const formAction = extraerDirectiva(csp, 'form-action')
    const scriptSrc = extraerDirectiva(csp, 'script-src')
    const connectSrc = extraerDirectiva(csp, 'connect-src')
    const frameSrc = extraerDirectiva(csp, 'frame-src')

    expect(formAction).toBe("form-action 'self' https://api.openpay.co https://checkout.openpay.co")
    expect(csp).not.toContain('sandbox-api.openpay.co')
    expect(scriptSrc).not.toContain('openpay.co')
    expect(scriptSrc).not.toContain('unsafe-eval')
    expect(connectSrc).toBe("connect-src 'self'")
    expect(connectSrc).not.toContain('openpay.co')
    expect(frameSrc).toBe('frame-src https://challenges.cloudflare.com')
    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('en desarrollo incluye sandbox-api.openpay.co en form-action y no expone Openpay en script-src ni connect-src', () => {
    const csp = construirCsp({
      nonce: 'nonce-dev-123',
      esDesarrollo: true,
      esHttps: false,
    })

    const formAction = extraerDirectiva(csp, 'form-action')
    const scriptSrc = extraerDirectiva(csp, 'script-src')
    const connectSrc = extraerDirectiva(csp, 'connect-src')

    expect(formAction).toBe("form-action 'self' https://sandbox-api.openpay.co")
    expect(formAction).not.toContain('https://api.openpay.co')
    expect(formAction).not.toContain('https://checkout.openpay.co')
    expect(scriptSrc).not.toContain('openpay.co')
    expect(connectSrc).not.toContain('openpay.co')
    expect(csp).not.toContain('upgrade-insecure-requests')
  })

  it('agrega origenCheckoutOpenpay solo a form-action si es HTTPS sin credenciales e ignora orígenes inseguros', () => {
    expect(normalizarOrigenHttps('https://pagos.openpay.co/checkout/123')).toBe('https://pagos.openpay.co')
    expect(normalizarOrigenHttps('http://pagos.openpay.co')).toBeNull()
    expect(normalizarOrigenHttps('https://user:pass@pagos.openpay.co')).toBeNull()
    expect(normalizarOrigenHttps('javascript:alert(1)')).toBeNull()

    const csp = construirCsp({
      nonce: 'nonce-extra',
      esDesarrollo: false,
      esHttps: true,
      origenCheckoutOpenpay: 'https://pagos.openpay.co/checkout/123',
    })
    expect(extraerDirectiva(csp, 'form-action')).toBe(
      "form-action 'self' https://api.openpay.co https://checkout.openpay.co https://pagos.openpay.co",
    )
    expect(extraerDirectiva(csp, 'script-src')).not.toContain('pagos.openpay.co')
    expect(extraerDirectiva(csp, 'connect-src')).not.toContain('pagos.openpay.co')

    const cspInseguro = construirCsp({
      nonce: 'nonce-inseguro',
      esDesarrollo: false,
      esHttps: true,
      origenCheckoutOpenpay: 'http://atacante.test',
    })
    expect(cspInseguro).not.toContain('atacante.test')
  })

  it('con openpaySandbox=true en producción agrega sandbox-api.openpay.co en form-action sin abrir unsafe-eval ni ws:', () => {
    const csp = construirCsp({
      nonce: 'nonce-staging-123',
      esDesarrollo: false,
      esHttps: true,
      openpaySandbox: true,
    })

    expect(extraerDirectiva(csp, 'form-action')).toBe(
      "form-action 'self' https://api.openpay.co https://checkout.openpay.co https://sandbox-api.openpay.co",
    )
    expect(extraerDirectiva(csp, 'script-src')).not.toContain('unsafe-eval')
    expect(extraerDirectiva(csp, 'connect-src')).toBe("connect-src 'self'")
  })
})
